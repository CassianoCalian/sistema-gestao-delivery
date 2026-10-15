import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Acao = "abrir" | "movimentar" | "fechar";

type Corpo = {
  acao?: Acao;
  turno_id?: number;
  tipo?: "sangria" | "suprimento";
  valor?: number;
  motivo?: string;
  observacao?: string;
  chave_idempotencia?: string;
};

function erroJson(mensagem: string, status: number) {
  return NextResponse.json(
    { erro: mensagem },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function valorValido(valor: unknown, permitirZero = false): valor is number {
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return false;
  }

  if (valor > 9999999999) return false;

  if (permitirZero ? valor < 0 : valor <= 0) {
    return false;
  }

  return Math.abs(valor * 100 - Math.round(valor * 100)) < 0.000001;
}

function traduzirErro(mensagem: string) {
  if (mensagem.includes("CAIXA_JA_ABERTO")) {
    return {
      mensagem: "Já existe um turno aberto neste caixa.",
      status: 409,
    };
  }

  if (mensagem.includes("TURNO_JA_FECHADO")) {
    return {
      mensagem: "Este turno já foi fechado.",
      status: 409,
    };
  }

  if (mensagem.includes("TURNO_NAO_ENCONTRADO")) {
    return {
      mensagem: "Turno não encontrado.",
      status: 404,
    };
  }

  if (mensagem.includes("CAIXA_NAO_ENCONTRADO")) {
    return {
      mensagem: "Caixa principal não encontrado.",
      status: 404,
    };
  }

  if (mensagem.includes("MOTIVO_OBRIGATORIO")) {
    return {
      mensagem: "Informe o motivo da movimentação.",
      status: 400,
    };
  }

  if (
    mensagem.includes("VALOR_INVALIDO") ||
    mensagem.includes("TIPO_INVALIDO") ||
    mensagem.includes("DADOS_INVALIDOS") ||
    mensagem.includes("CHAVE_REUTILIZADA")
  ) {
    return {
      mensagem: "Confira os dados informados.",
      status: 400,
    };
  }

  return {
    mensagem: "Não foi possível concluir a operação do caixa.",
    status: 500,
  };
}

// CONSULTA O CAIXA E O RESUMO FINANCEIRO

export async function GET() {
  let usuario: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    usuario = await requireAdmin();
  } catch {
    return erroJson("Não autorizado.", 401);
  }

  try {
    const { data: caixa, error: erroCaixa } = await supabaseAdmin
      .from("pdv_caixas")
      .select("id, codigo, nome, ativo")
      .eq("codigo", "principal")
      .maybeSingle();

    if (erroCaixa || !caixa) {
      console.error("Erro ao buscar caixa:", erroCaixa);
      return erroJson("Caixa principal não configurado.", 500);
    }

    const { data: turnos, error: erroTurnos } = await supabaseAdmin
      .from("pdv_turnos")
      .select(
        `
          id,
          caixa_id,
          status,
          aberto_em,
          operador_abertura_email,
          valor_inicial,
          fechado_em,
          operador_fechamento_email,
          valor_contado,
          observacao_fechamento
          `,
      )
      .eq("caixa_id", caixa.id)
      .order("id", { ascending: false })
      .limit(30);

    if (erroTurnos) {
      console.error("Erro ao consultar turnos:", erroTurnos);
      return erroJson("Não foi possível consultar os turnos.", 500);
    }

    const listaTurnos = turnos ?? [];

    const turnoAberto =
      listaTurnos.find((turno) => turno.status === "aberto") ?? null;

    let movimentacoes: unknown[] = [];

    if (turnoAberto) {
      const { data, error } = await supabaseAdmin
        .from("pdv_caixa_movimentacoes")
        .select(
          `
          id,
          turno_id,
          created_at,
          tipo,
          valor,
          motivo,
          operador_email
          `,
        )
        .eq("turno_id", turnoAberto.id)
        .order("id", { ascending: false });

      if (error) {
        console.error("Erro ao consultar movimentações:", error);

        return erroJson("Não foi possível consultar as movimentações.", 500);
      }

      movimentacoes = data ?? [];
    }

    // Consulta a nova função SQL instalada no Supabase.
    // Inclui vendas em dinheiro, Pix, débito, crédito,
    // sangrias, suprimentos e diferenças de fechamento.

    const { data: resumos, error: erroResumo } = await supabaseAdmin.rpc(
      "resumo_financeiro_turnos_pdv",
      {
        p_caixa_codigo: "principal",
        p_limite: 30,
      },
    );

    if (erroResumo) {
      console.error("Erro ao consultar resumo financeiro:", erroResumo);

      return erroJson(
        "O resumo financeiro ainda não está disponível. Confira a nova migração SQL.",
        500,
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        caixa,
        operador_atual: usuario.email,
        turno_aberto: turnoAberto,
        turnos: listaTurnos,
        movimentacoes,
        resumos_financeiros: resumos ?? [],
        vendas_integradas: true,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Erro ao carregar controle de caixa:", error);

    return erroJson("Erro interno ao consultar o caixa.", 500);
  }
}

// ABERTURA, SANGRIA, SUPRIMENTO E FECHAMENTO

export async function POST(request: Request) {
  let usuario: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    usuario = await requireAdmin();
  } catch {
    return erroJson("Não autorizado.", 401);
  }

  if (!usuario.email) {
    return erroJson("Operador sem e-mail válido.", 403);
  }

  let body: Corpo;

  try {
    body = (await request.json()) as Corpo;
  } catch {
    return erroJson("Dados inválidos.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return erroJson("Dados inválidos.", 400);
  }

  const chave = body.chave_idempotencia;

  if (
    typeof chave !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      chave,
    )
  ) {
    return erroJson("Identificador da operação inválido.", 400);
  }

  if (
    body.acao !== "abrir" &&
    body.acao !== "movimentar" &&
    body.acao !== "fechar"
  ) {
    return erroJson("Operação inválida.", 400);
  }

  const permitirZero = body.acao === "abrir" || body.acao === "fechar";

  if (!valorValido(body.valor, permitirZero)) {
    return erroJson("Informe um valor monetário válido.", 400);
  }

  if (
    body.acao !== "abrir" &&
    (!Number.isSafeInteger(body.turno_id) || (body.turno_id ?? 0) <= 0)
  ) {
    return erroJson("Turno inválido.", 400);
  }

  try {
    let resultado: {
      data: unknown;
      error: { message: string } | null;
    };

    if (body.acao === "abrir") {
      resultado = await supabaseAdmin.rpc("abrir_turno_pdv", {
        p_caixa_codigo: "principal",
        p_valor_inicial: body.valor,
        p_operador_uid: usuario.id,
        p_operador_email: usuario.email,
        p_chave: chave,
      });
    } else if (body.acao === "movimentar") {
      if (body.tipo !== "sangria" && body.tipo !== "suprimento") {
        return erroJson("Tipo de movimentação inválido.", 400);
      }

      if (
        typeof body.motivo !== "string" ||
        body.motivo.trim().length < 3 ||
        body.motivo.length > 500
      ) {
        return erroJson("Informe um motivo de pelo menos 3 caracteres.", 400);
      }

      resultado = await supabaseAdmin.rpc("movimentar_caixa_pdv", {
        p_turno_id: body.turno_id!,
        p_tipo: body.tipo,
        p_valor: body.valor,
        p_motivo: body.motivo.trim(),
        p_operador_uid: usuario.id,
        p_operador_email: usuario.email,
        p_chave: chave,
      });
    } else {
      if (
        body.observacao !== undefined &&
        (typeof body.observacao !== "string" || body.observacao.length > 1000)
      ) {
        return erroJson("Observação de fechamento inválida.", 400);
      }

      resultado = await supabaseAdmin.rpc("fechar_turno_pdv", {
        p_turno_id: body.turno_id!,
        p_valor_contado: body.valor,
        p_observacao: body.observacao?.trim() ?? "",
        p_operador_uid: usuario.id,
        p_operador_email: usuario.email,
        p_chave: chave,
      });
    }

    if (resultado.error) {
      console.error("Erro na operação do caixa:", resultado.error);

      const erro = traduzirErro(resultado.error.message ?? "");

      return erroJson(erro.mensagem, erro.status);
    }

    return NextResponse.json(
      {
        sucesso: true,
        id: resultado.data,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Erro inesperado no caixa:", error);

    return erroJson("Erro interno ao processar a operação.", 500);
  }
}

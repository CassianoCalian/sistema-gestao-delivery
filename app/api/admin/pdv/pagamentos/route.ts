import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type Forma = "pix" | "dinheiro" | "debito" | "credito";

type Parcela = {
  forma: Forma;
  valor: number;
};

type Dados = {
  tipo: "entrega" | "balcao";
  registro_id: number;
  total_esperado: number;
  pagamento_confirmado: boolean;
  parcelas: Parcela[];
};

const formas = ["pix", "dinheiro", "debito", "credito"];

function erro(mensagem: string, status: number) {
  return NextResponse.json({ erro: mensagem }, { status });
}

function centavos(valor: number) {
  return Math.round(valor * 100);
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return erro("Acesso não autorizado.", 401);
  }

  try {
    const body = (await request.json()) as Dados;

    if (
      !body ||
      (body.tipo !== "entrega" && body.tipo !== "balcao") ||
      !Number.isSafeInteger(body.registro_id) ||
      body.registro_id <= 0 ||
      typeof body.total_esperado !== "number" ||
      !Number.isFinite(body.total_esperado) ||
      body.total_esperado <= 0 ||
      typeof body.pagamento_confirmado !== "boolean" ||
      !Array.isArray(body.parcelas) ||
      body.parcelas.length < 1 ||
      body.parcelas.length > 2
    ) {
      return erro("Dados de pagamento inválidos.", 400);
    }

    const parcelas = body.parcelas;

    if (
      parcelas.some(
        (p) =>
          !p ||
          !formas.includes(p.forma) ||
          typeof p.valor !== "number" ||
          !Number.isFinite(p.valor) ||
          centavos(p.valor) <= 0 ||
          Math.abs(p.valor * 100 - centavos(p.valor)) > 0.001,
      )
    ) {
      return erro("Verifique os valores e as formas.", 400);
    }

    if (parcelas.length === 2 && parcelas[0].forma === parcelas[1].forma) {
      return erro("Selecione duas formas diferentes.", 400);
    }

    if (body.tipo === "balcao" && !body.pagamento_confirmado) {
      return erro("Confirme o recebimento da venda.", 400);
    }

    const tabela = body.tipo === "entrega" ? "pedidos" : "pdv_vendas";

    const { data: registro, error: erroConsulta } = await supabaseAdmin
      .from(tabela)
      .select("id, total, status")
      .eq("id", body.registro_id)
      .maybeSingle();

    if (erroConsulta || !registro) {
      return erro("Registro não encontrado.", 404);
    }

    if (registro.status === "cancelado" || registro.status === "cancelada") {
      return erro("Não é possível alterar registro cancelado.", 409);
    }

    const totalBanco = centavos(Number(registro.total));
    const totalInformado = centavos(body.total_esperado);

    const soma = parcelas.reduce(
      (acumulado, parcela) => acumulado + centavos(parcela.valor),
      0,
    );

    if (totalBanco !== totalInformado || soma !== totalBanco) {
      return erro(
        "Os pagamentos não correspondem ao total real. Confira o pedido.",
        409,
      );
    }

    const detalhes = {
      versao: 1,
      origem: "pdv",
      parcelas,
      pago: body.pagamento_confirmado,
    };

    const atualizacao =
      body.tipo === "entrega"
        ? {
            pagamentos_detalhes: detalhes,
            pagamento_confirmado: body.pagamento_confirmado,
          }
        : {
            pagamentos_detalhes: detalhes,
          };

    const { data: salvo, error: erroSalvar } = await supabaseAdmin
      .from(tabela)
      .update(atualizacao)
      .eq("id", body.registro_id)
      .eq("status", registro.status)
      .select("id")
      .maybeSingle();

    if (erroSalvar || !salvo) {
      console.error("Erro ao salvar pagamento:", erroSalvar);
      return erro("Não foi possível salvar o pagamento.", 500);
    }

    return NextResponse.json({
      sucesso: true,
      registro_id: salvo.id,
      total: Number(registro.total),
      pagamento_confirmado: body.pagamento_confirmado,
      parcelas,
    });
  } catch (error) {
    console.error("Erro no pagamento do PDV:", error);
    return erro("Erro interno ao salvar pagamento.", 500);
  }
}

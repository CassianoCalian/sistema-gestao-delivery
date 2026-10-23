import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CorpoVenda = {
  chave_idempotencia?: string;
  cliente_id?: number | null;
  forma_pagamento?: string;
  troco_para?: number | null;
  total_esperado?: number;
  pagamento_confirmado?: boolean;
  itens?: {
    id: number;
    quantidade: number;
    opcoes_selecionadas?: {
      opcao_id: number;
      quantidade: number;
    }[];
  }[];
};

function responderErro(erro: string, status: number) {
  return NextResponse.json(
    { erro },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  let operador: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    operador = await requireAdmin();
  } catch {
    return responderErro("Não autorizado.", 401);
  }

  if (!operador.email) {
    return responderErro("O operador precisa ter um e-mail válido.", 403);
  }

  try {
    const body = (await request.json()) as CorpoVenda;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return responderErro("Dados de venda inválidos.", 400);
    }

    const chave = body.chave_idempotencia ?? "";

    const uuidValido =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        chave,
      );

    if (!uuidValido) {
      return responderErro("Identificador da venda inválido.", 400);
    }

    const pagamentosPermitidos = ["pix", "dinheiro", "debito", "credito"];

    if (
      !body.forma_pagamento ||
      !pagamentosPermitidos.includes(body.forma_pagamento)
    ) {
      return responderErro("Selecione uma forma de pagamento.", 400);
    }

    if (body.pagamento_confirmado !== true) {
      return responderErro(
        "Confirme o recebimento do pagamento antes de finalizar.",
        400,
      );
    }

    if (
      !Array.isArray(body.itens) ||
      body.itens.length === 0 ||
      body.itens.length > 100
    ) {
      return responderErro("Carrinho inválido.", 400);
    }

    const ids = new Set<number>();

    for (const item of body.itens) {
      if (
        !item ||
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        !Number.isInteger(item.quantidade) ||
        item.quantidade <= 0 ||
        item.quantidade > 999 ||
        ids.has(item.id)
      ) {
        return responderErro(
          "Existe um produto ou quantidade inválida no carrinho.",
          400,
        );
      }

      const opcoes = item.opcoes_selecionadas ?? [];

      if (
        !Array.isArray(opcoes) ||
        opcoes.length > 100 ||
        opcoes.some(
          (opcao) =>
            !opcao ||
            !Number.isSafeInteger(opcao.opcao_id) ||
            opcao.opcao_id <= 0 ||
            !Number.isInteger(opcao.quantidade) ||
            opcao.quantidade <= 0 ||
            opcao.quantidade > 999,
        )
      ) {
        return responderErro("Selecao de sabores invalida.", 400);
      }

      ids.add(item.id);
    }

    const clienteId = body.cliente_id ?? null;

    if (
      clienteId !== null &&
      (!Number.isSafeInteger(clienteId) || clienteId <= 0)
    ) {
      return responderErro("Cliente inválido.", 400);
    }

    const totalEsperado = body.total_esperado;

    if (
      typeof totalEsperado !== "number" ||
      !Number.isFinite(totalEsperado) ||
      totalEsperado < 0
    ) {
      return responderErro("Total inválido.", 400);
    }

    const trocoPara =
      body.forma_pagamento === "dinheiro" ? (body.troco_para ?? null) : null;

    if (trocoPara !== null && (!Number.isFinite(trocoPara) || trocoPara <= 0)) {
      return responderErro("Valor para troco inválido.", 400);
    }

    // Registra a venda e associa ao turno aberto.
    // Operador e caixa sao definidos no servidor.
    // A funcao SQL utiliza a funcao original de venda,
    // preservando as regras atuais de preco e estoque.

    const { data, error } = await supabaseAdmin.rpc(
      "registrar_venda_pdv_no_caixa",
      {
        p_chave_idempotencia: chave,
        p_cliente_id: clienteId,
        p_forma_pagamento: body.forma_pagamento,
        p_troco_para: trocoPara,
        p_total_esperado: totalEsperado,
        p_itens: body.itens,
        p_operador_uid: operador.id,
        p_operador_email: operador.email,
        p_caixa_codigo: "principal",
      },
    );

    if (error) {
      console.error("Erro ao registrar venda do PDV com turno:", error);

      const mensagem = error.message ?? "";

      if (mensagem.includes("TURNO_NAO_ABERTO")) {
        return responderErro(
          "Abra um turno no Controle de Caixa antes de registrar a venda.",
          409,
        );
      }

      if (
        mensagem.includes("VENDA_ANTIGA_SEM_TURNO") ||
        mensagem.includes("VENDA_JA_VINCULADA") ||
        mensagem.includes("CHAVE_REUTILIZADA")
      ) {
        return responderErro(
          "Essa venda já foi registrada. Consulte o histórico antes de tentar novamente.",
          409,
        );
      }

      if (mensagem.includes("TOTAL_ALTERADO")) {
        return responderErro(
          "O preço de algum produto mudou. Atualize o PDV e confira o total antes de receber o pagamento.",
          409,
        );
      }

      if (mensagem.includes("ESTOQUE")) {
        return responderErro(
          "Estoque insuficiente. Atualize o PDV e confira os produtos.",
          409,
        );
      }

      if (mensagem.includes("OPCOES_INVALIDAS")) {
        return responderErro(
          "Confira os sabores e as quantidades escolhidas.",
          400,
        );
      }

      if (mensagem.includes("PRODUTO_COM_OPCOES")) {
        return responderErro(
          "Esse produto exige seleção de sabores. A finalização desse tipo de produto será habilitada na próxima etapa.",
          400,
        );
      }

      if (
        mensagem.includes("PRODUTO_INATIVO") ||
        mensagem.includes("PRODUTO_NAO_ENCONTRADO")
      ) {
        return responderErro(
          "Um dos produtos não está mais disponível. Atualize o PDV.",
          409,
        );
      }

      if (
        mensagem.includes("CLIENTE_INVALIDO") ||
        mensagem.includes("ITEM_INVALIDO") ||
        mensagem.includes("ITEM_DUPLICADO") ||
        mensagem.includes("CARRINHO_INVALIDO") ||
        mensagem.includes("TROCO_INVALIDO") ||
        mensagem.includes("PAGAMENTO_INVALIDO") ||
        mensagem.includes("OPERADOR_INVALIDO")
      ) {
        return responderErro(
          "Confira os dados da venda e tente novamente.",
          400,
        );
      }

      return responderErro(
        "Não foi possível registrar a venda. Confira o histórico antes de tentar novamente.",
        500,
      );
    }

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado) {
      return responderErro(
        "O servidor não confirmou o registro da venda.",
        500,
      );
    }

    const { count: numeroTurno, error: erroNumeroTurno } = await supabaseAdmin
      .from("pdv_vendas")
      .select("id", { count: "exact", head: true })
      .eq("turno_id", resultado.id_turno)
      .lte("id", resultado.id_venda);

    if (erroNumeroTurno) {
      console.error("Erro na numeracao do turno:", erroNumeroTurno);
    }

    return NextResponse.json(
      {
        sucesso: true,
        venda_id: resultado.id_venda,
        turno_id: resultado.id_turno,
        numero_turno: numeroTurno,
        subtotal: Number(resultado.valor_subtotal),
        taxa_cartao: Number(resultado.valor_taxa_cartao),
        total: Number(resultado.valor_total),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado no PDV:", error);

    return responderErro("Não foi possível concluir a operação.", 500);
  }
}

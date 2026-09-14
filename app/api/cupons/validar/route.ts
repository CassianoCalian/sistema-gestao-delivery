import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ValidarCupomBody = {
  codigo_cupom?: string;
  telefone?: string;
  subtotal?: number;
};

function normalizarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, "");

  if (
    (numeros.length === 12 || numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    return numeros.slice(2);
  }

  return numeros;
}

function arredondarMoeda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidarCupomBody;

    const codigo =
      typeof body.codigo_cupom === "string"
        ? body.codigo_cupom.trim().toUpperCase()
        : "";

    const telefone =
      typeof body.telefone === "string"
        ? normalizarTelefone(body.telefone)
        : "";

    const subtotal = Number(body.subtotal);

    if (!codigo) {
      return NextResponse.json(
        {
          erro: "Informe o código do cupom.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (telefone.length < 10 || telefone.length > 11) {
      return NextResponse.json(
        {
          erro: "Informe seu WhatsApp antes de aplicar o cupom.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!Number.isFinite(subtotal) || subtotal <= 0) {
      return NextResponse.json(
        {
          erro: "O valor do carrinho é inválido.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const { data: cliente, error: erroCliente } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("telefone_normalizado", telefone)
      .maybeSingle();

    if (erroCliente) {
      console.error("Erro ao localizar cliente do cupom:", erroCliente);

      return NextResponse.json(
        {
          erro: "Não foi possível validar o cupom neste momento.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    /*
     * Não diferenciamos "telefone não cadastrado"
     * de "cupom inexistente" para não expor cadastros.
     */
    if (!cliente) {
      return NextResponse.json(
        {
          erro: "Cupom inválido para este cliente.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const { data: cupom, error: erroCupom } = await supabaseAdmin
      .from("cupons")
      .select(
        `
          id,
          codigo,
          tipo,
          percentual,
          desconto_maximo,
          valor_minimo_pedido,
          valido_ate,
          ativo,
          usado_em,
          pedido_id_usado
        `,
      )
      .eq("cliente_id", cliente.id)
      .eq("codigo", codigo)
      .maybeSingle();

    if (erroCupom) {
      console.error("Erro ao validar cupom:", erroCupom);

      return NextResponse.json(
        {
          erro: "Não foi possível validar o cupom neste momento.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!cupom) {
      return NextResponse.json(
        {
          erro: "Cupom inválido para este cliente.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (
      !cupom.ativo ||
      cupom.usado_em !== null ||
      cupom.pedido_id_usado !== null
    ) {
      return NextResponse.json(
        {
          erro: "Este cupom não está mais disponível.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (new Date(cupom.valido_ate).getTime() <= Date.now()) {
      return NextResponse.json(
        {
          erro: "Este cupom expirou.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (cupom.tipo !== "percentual") {
      return NextResponse.json(
        {
          erro: "Este tipo de cupom não é aceito.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const valorMinimoPedido = Number(cupom.valor_minimo_pedido);

    if (subtotal < valorMinimoPedido) {
      return NextResponse.json(
        {
          erro: `Este cupom exige pelo menos ${valorMinimoPedido.toLocaleString(
            "pt-BR",
            {
              style: "currency",
              currency: "BRL",
            },
          )} em produtos.`,
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const percentual = Number(cupom.percentual);
    const descontoMaximo = Number(cupom.desconto_maximo);

    const descontoEstimado = arredondarMoeda(
      Math.min(subtotal * (percentual / 100), descontoMaximo),
    );

    return NextResponse.json(
      {
        valido: true,
        codigo: cupom.codigo,
        percentual,
        desconto_maximo: descontoMaximo,
        desconto_estimado: descontoEstimado,
        valido_ate: cupom.valido_ate,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado ao validar cupom:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao validar o cupom.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

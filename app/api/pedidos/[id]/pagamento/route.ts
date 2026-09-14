import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json(
        {
          erro: "Não autorizado.",
        },
        {
          status: 401,
        },
      );
    }

    const { id } = await params;

    const pedidoId = Number(id);

    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
      return NextResponse.json(
        {
          erro: "Pedido inválido.",
        },
        {
          status: 400,
        },
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          erro: "Os dados enviados são inválidos.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const pagamentoConfirmado =
      typeof body === "object" &&
      body !== null &&
      "pagamento_confirmado" in body &&
      typeof (body as { pagamento_confirmado?: unknown })
        .pagamento_confirmado === "boolean"
        ? (body as { pagamento_confirmado: boolean }).pagamento_confirmado
        : null;

    if (typeof pagamentoConfirmado !== "boolean") {
      return NextResponse.json(
        {
          erro: "Valor de pagamento inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: pedidoAtual, error: erroPedido } = await supabaseAdmin
      .from("pedidos")
      .select(
        `
          id,
          status,
          forma_pagamento,
          pagamento_confirmado
        `,
      )
      .eq("id", pedidoId)
      .maybeSingle();

    if (erroPedido) {
      console.error("Erro ao consultar pedido:", erroPedido);

      return NextResponse.json(
        {
          erro: "Não foi possível consultar o pedido.",
        },
        {
          status: 500,
        },
      );
    }

    if (!pedidoAtual) {
      return NextResponse.json(
        {
          erro: "Pedido não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    if (pedidoAtual.forma_pagamento !== "pix") {
      return NextResponse.json(
        {
          erro: "A confirmação de pagamento é permitida apenas para pedidos via PIX.",
        },
        {
          status: 400,
        },
      );
    }

    if (pedidoAtual.status === "cancelado") {
      return NextResponse.json(
        {
          erro: "Não é possível alterar o pagamento de um pedido cancelado.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      !pagamentoConfirmado &&
      (pedidoAtual.status === "saiu_entrega" ||
        pedidoAtual.status === "entregue")
    ) {
      return NextResponse.json(
        {
          erro: "Não é possível remover a confirmação do PIX depois que o pedido saiu para entrega.",
        },
        {
          status: 400,
        },
      );
    }

    if (pedidoAtual.pagamento_confirmado === pagamentoConfirmado) {
      return NextResponse.json({
        sucesso: true,
        pedido: pedidoAtual,
      });
    }

    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .update({
        pagamento_confirmado: pagamentoConfirmado,
      })
      .eq("id", pedidoId)
      .eq("status", pedidoAtual.status)
      .eq("pagamento_confirmado", pedidoAtual.pagamento_confirmado)
      .select("id, pagamento_confirmado")
      .maybeSingle();

    if (error) {
      console.error("Erro ao atualizar pagamento:", error);

      return NextResponse.json(
        {
          erro: "Não foi possível atualizar o pagamento.",
        },
        {
          status: 500,
        },
      );
    }

    if (!pedido) {
      return NextResponse.json(
        {
          erro: "O pedido foi atualizado por outra operação. Atualize a página e tente novamente.",
        },
        {
          status: 409,
        },
      );
    }

    return NextResponse.json({
      sucesso: true,
      pedido,
    });
  } catch (error) {
    console.error("Erro na rota de pagamento:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao atualizar pagamento.",
      },
      {
        status: 500,
      },
    );
  }
}

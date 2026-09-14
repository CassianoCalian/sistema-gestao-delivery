import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const STATUS_PERMITIDOS = [
  "recebido",
  "em_preparacao",
  "saiu_entrega",
  "entregue",
  "cancelado",
];

const TRANSICOES_PERMITIDAS: Record<string, string[]> = {
  recebido: ["em_preparacao", "cancelado"],
  em_preparacao: ["recebido", "saiu_entrega", "cancelado"],
  saiu_entrega: ["em_preparacao", "entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};
export async function PATCH(request: Request, { params }: RouteContext) {
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
      return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
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

    const status =
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      typeof (body as { status?: unknown }).status === "string"
        ? (body as { status: string }).status
        : "";

    if (typeof status !== "string" || !STATUS_PERMITIDOS.includes(status)) {
      return NextResponse.json({ erro: "Status inválido." }, { status: 400 });
    }

    // Cancelamento precisa ser feito pela função transacional do banco.
    // Ela cancela o pedido e devolve os itens ao estoque em uma única operação.
    if (status === "cancelado") {
      const { data, error } = await supabaseAdmin.rpc(
        "cancelar_pedido_repor_estoque",
        {
          p_pedido_id: pedidoId,
        },
      );

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Erro ao cancelar pedido:", error);
        } else {
          console.error("Erro ao cancelar pedido.");
        }

        if (error.message.includes("PEDIDO_NAO_ENCONTRADO")) {
          return NextResponse.json(
            { erro: "Pedido não encontrado." },
            { status: 404 },
          );
        }

        if (error.message.includes("PEDIDO_ENTREGUE_NAO_PODE_SER_CANCELADO")) {
          return NextResponse.json(
            {
              erro: "Um pedido já entregue não pode ser cancelado.",
            },
            { status: 400 },
          );
        }

        return NextResponse.json(
          {
            erro: "Não foi possível cancelar o pedido.",
          },
          { status: 500 },
        );
      }

      const pedidoCancelado = Array.isArray(data) ? data[0] : data;

      return NextResponse.json({
        sucesso: true,
        pedido: pedidoCancelado,
      });
    }

    // Para outros status, primeiro buscamos a situação atual do pedido.
    const { data: pedidoAtual, error: erroPedidoAtual } = await supabaseAdmin
      .from("pedidos")
      .select("id, status, forma_pagamento, pagamento_confirmado")
      .eq("id", pedidoId)
      .single();

    if (erroPedidoAtual || !pedidoAtual) {
      if (erroPedidoAtual) {
        if (process.env.NODE_ENV === "development") {
          console.error("Erro ao consultar pedido:", erroPedidoAtual);
        } else {
          console.error("Erro ao consultar pedido.");
        }
      }

      return NextResponse.json(
        { erro: "Pedido não encontrado." },
        { status: 404 },
      );
    }

    // Um pedido cancelado não pode voltar para outro status.
    // Isso evita inconsistências porque o estoque já foi devolvido.
    if (pedidoAtual.status === "cancelado") {
      return NextResponse.json(
        {
          erro: "Pedido cancelado não pode ser reaberto.",
        },
        { status: 400 },
      );
    }

    const exigePagamentoPixConfirmado =
      pedidoAtual.forma_pagamento === "pix" &&
      !pedidoAtual.pagamento_confirmado &&
      (status === "saiu_entrega" || status === "entregue");

    if (exigePagamentoPixConfirmado) {
      return NextResponse.json(
        {
          erro: "Confirme o pagamento PIX antes de enviar o pedido para entrega.",
        },
        { status: 400 },
      );
    }

    const transicoesPermitidas =
      TRANSICOES_PERMITIDAS[pedidoAtual.status] ?? [];

    if (!transicoesPermitidas.includes(status)) {
      return NextResponse.json(
        {
          erro: `Não é permitido alterar o pedido de "${pedidoAtual.status}" para "${status}".`,
        },
        { status: 400 },
      );
    }

    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .update({
        status,
      })
      .eq("id", pedidoId)
      .eq("status", pedidoAtual.status)
      .eq("pagamento_confirmado", pedidoAtual.pagamento_confirmado)
      .select("id, status")
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Erro ao atualizar pedido:", error);
      } else {
        console.error("Erro ao atualizar pedido.");
      }

      return NextResponse.json(
        {
          erro: "Não foi possível atualizar o pedido.",
        },
        { status: 500 },
      );
    }

    if (!pedido) {
      return NextResponse.json(
        {
          erro: "O pedido foi atualizado por outra operação. Atualize a página e tente novamente.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      pedido,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Erro ao alterar status:", error);
    } else {
      console.error("Erro ao alterar status.");
    }

    return NextResponse.json(
      { erro: "Erro interno ao atualizar o pedido." },
      { status: 500 },
    );
  }
}

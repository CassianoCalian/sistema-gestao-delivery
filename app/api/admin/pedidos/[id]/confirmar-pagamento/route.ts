import { NextResponse } from "next/server";
import { verificarAdmin } from "../../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Contexto = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, contexto: Contexto) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json(
        { erro: "Nao autorizado." },
        { status: 401 },
      );
    }

    const origem = request.headers.get("origin");
    const origemServidor = new URL(request.url).origin;

    if (origem && origem !== origemServidor) {
      return NextResponse.json(
        { erro: "Origem nao autorizada." },
        { status: 403 },
      );
    }

    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json(
        { erro: "Solicitacao nao autorizada." },
        { status: 403 },
      );
    }

    const { id: textoId } = await contexto.params;
    const id = Number(textoId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { erro: "Pedido invalido." },
        { status: 400 },
      );
    }

    let corpo: unknown;

    try {
      corpo = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "Dados invalidos." },
        { status: 400 },
      );
    }

    if (
      !corpo ||
      typeof corpo !== "object" ||
      !("confirmar" in corpo) ||
      corpo.confirmar !== true
    ) {
      return NextResponse.json(
        { erro: "Confirmacao explicita obrigatoria." },
        { status: 400 },
      );
    }

    const { data: pedido, error: erroConsulta } = await supabaseAdmin
      .from("pedidos")
      .select("id, status, forma_pagamento, pagamento_confirmado, pagamentos_detalhes")
      .eq("id", id)
      .maybeSingle();

    if (erroConsulta) {
      return NextResponse.json(
        { erro: "Erro ao consultar pedido." },
        { status: 500 },
      );
    }

    if (!pedido) {
      return NextResponse.json(
        { erro: "Pedido nao encontrado." },
        { status: 404 },
      );
    }

    if (pedido.status === "cancelado") {
      return NextResponse.json(
        { erro: "Pedido cancelado nao pode ser marcado como pago." },
        { status: 409 },
      );
    }

    if (
      !["pix", "dinheiro", "cartao_entrega"].includes(
        pedido.forma_pagamento,
      )
    ) {
      return NextResponse.json(
        { erro: "Forma de pagamento nao permitida." },
        { status: 400 },
      );
    }

    if (pedido.pagamento_confirmado === true) {
      return NextResponse.json({
        sucesso: true,
        ja_confirmado: true,
      });
    }
    const detalhes = pedido.pagamentos_detalhes as {
      parcelas?: Array<{
        forma: string;
        valor: number;
        recebido?: boolean;
      }>;
      [chave: string]: unknown;
    } | null;

    const parcelasQuitadas =
      Array.isArray(detalhes?.parcelas)
        ? detalhes.parcelas.map((p) => ({
            ...p,
            recebido: true,
          }))
        : null;

    const atualizacao = parcelasQuitadas
      ? {
          pagamento_confirmado: true,
          pagamentos_detalhes: {
            ...detalhes,
            parcelas: parcelasQuitadas,
            pago: true,
          },
        }
      : { pagamento_confirmado: true };



    const { data: atualizado, error: erroAtualizacao } =
      await supabaseAdmin
        .from("pedidos")
        .update(atualizacao)
        .eq("id", id)
        .eq("status", pedido.status)
        .eq("forma_pagamento", pedido.forma_pagamento)
        .eq("pagamento_confirmado", false)
        .select("id, pagamento_confirmado")
        .maybeSingle();

    if (erroAtualizacao) {
      return NextResponse.json(
        { erro: "Falha ao registrar pagamento." },
        { status: 500 },
      );
    }

    if (!atualizado) {
      return NextResponse.json(
        {
          erro: "O pedido mudou durante a operacao. Atualize e confira.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      pedido_id: atualizado.id,
      pagamento_confirmado: atualizado.pagamento_confirmado,
    });
  } catch {
    return NextResponse.json(
      { erro: "Erro interno na confirmacao." },
      { status: 500 },
    );
  }
}
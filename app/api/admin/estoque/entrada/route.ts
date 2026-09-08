import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

export async function POST(request: Request) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();

    const produtoId = Number(body.produto_id);
    const quantidade = Number(body.quantidade);

    const observacao =
      typeof body.observacao === "string" ? body.observacao.trim() : "";

    if (!Number.isInteger(produtoId) || produtoId <= 0) {
      return NextResponse.json({ erro: "Produto inválido." }, { status: 400 });
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      return NextResponse.json(
        { erro: "Informe uma quantidade válida." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "registrar_entrada_estoque",
      {
        p_produto_id: produtoId,
        p_quantidade: quantidade,
        p_observacao: observacao || null,
      },
    );

    if (error) {
      console.error("Erro ao registrar entrada de estoque:", error);

      if (error.message.includes("PRODUTO_NAO_ENCONTRADO")) {
        return NextResponse.json(
          { erro: "Produto não encontrado." },
          { status: 404 },
        );
      }

      if (error.message.includes("QUANTIDADE_INVALIDA")) {
        return NextResponse.json(
          { erro: "Quantidade inválida." },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          erro: "Não foi possível registrar a entrada.",
        },
        { status: 500 },
      );
    }

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado) {
      return NextResponse.json(
        {
          erro: "A entrada não retornou os dados esperados.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      produto_id: resultado.produto_id,
      estoque_anterior: resultado.estoque_anterior,
      estoque_novo: resultado.estoque_novo,
    });
  } catch (error) {
    console.error("Erro interno ao registrar entrada:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao registrar entrada.",
      },
      { status: 500 },
    );
  }
}

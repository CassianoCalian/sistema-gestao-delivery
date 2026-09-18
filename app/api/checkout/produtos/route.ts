import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type CorpoRecebido = {
  ids?: number[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CorpoRecebido;

    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids)].filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { erro: "Nenhum produto válido foi informado." },
        { status: 400 },
      );
    }

    if (ids.length > 50) {
      return NextResponse.json(
        { erro: "Quantidade de produtos inválida." },
        { status: 400 },
      );
    }

    const { data: produtos, error: erroProdutos } = await supabaseAdmin
      .from("produtos")
      .select("id, unidades_por_item")
      .in("id", ids);

    if (erroProdutos) {
      console.error("Erro ao buscar configuração dos produtos:", erroProdutos);

      return NextResponse.json(
        { erro: "Não foi possível consultar os produtos." },
        { status: 500 },
      );
    }

    const { data: opcoes, error: erroOpcoes } = await supabaseAdmin
      .from("produto_opcoes")
      .select("id, produto_id, nome, ativo, ordem")
      .in("produto_id", ids)
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (erroOpcoes) {
      console.error("Erro ao buscar opções dos produtos:", erroOpcoes);

      return NextResponse.json(
        { erro: "Não foi possível consultar as opções dos produtos." },
        { status: 500 },
      );
    }

    const resultado = (produtos ?? []).map((produto) => ({
      id: produto.id,
      unidades_por_item: Number(produto.unidades_por_item ?? 0),
      opcoes: (opcoes ?? [])
        .filter((opcao) => opcao.produto_id === produto.id)
        .map((opcao) => ({
          id: opcao.id,
          nome: opcao.nome,
          ativo: opcao.ativo,
          ordem: opcao.ordem,
        })),
    }));

    return NextResponse.json(
      { produtos: resultado },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado ao consultar produtos do checkout:", error);

    return NextResponse.json(
      { erro: "Erro interno ao consultar os produtos." },
      { status: 500 },
    );
  }
}

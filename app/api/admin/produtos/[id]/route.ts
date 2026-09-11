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
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;

    const produtoId = Number(id);

    if (!Number.isInteger(produtoId) || produtoId <= 0) {
      return NextResponse.json({ erro: "Produto inválido." }, { status: 400 });
    }

    const body = await request.json();

    const {
      nome,
      descricao,
      preco,
      preco_promocional,
      estoque,
      estoque_minimo,
      imagem_url,
      ativo,
      destaque,
      em_promocao,
      permite_abaixo_minimo,
      categoria_id,
    } = body;

    const categoriaIdNumero = Number(categoria_id);

    if (!Number.isInteger(categoriaIdNumero) || categoriaIdNumero <= 0) {
      return NextResponse.json(
        { erro: "Selecione uma categoria válida." },
        { status: 400 },
      );
    }

    const { data: categoria } = await supabaseAdmin
      .from("categorias")
      .select("id, slug, ativo")
      .eq("id", categoriaIdNumero)
      .eq("ativo", true)
      .maybeSingle();

    if (!categoria) {
      return NextResponse.json(
        {
          erro: "A categoria selecionada não existe ou está inativa.",
        },
        { status: 400 },
      );
    }

    if (categoria.slug === "promocoes") {
      return NextResponse.json(
        {
          erro: "Promoções não pode ser usada como categoria do produto.",
        },
        { status: 400 },
      );
    }

    if (typeof nome !== "string" || !nome.trim()) {
      return NextResponse.json(
        { erro: "Informe o nome do produto." },
        { status: 400 },
      );
    }

    const precoNumero = Number(preco);
    const estoqueNumero = Number(estoque);
    const estoqueMinimoNumero = Number(estoque_minimo);

    if (!Number.isFinite(precoNumero) || precoNumero < 0) {
      return NextResponse.json({ erro: "Preço inválido." }, { status: 400 });
    }

    if (!Number.isInteger(estoqueNumero) || estoqueNumero < 0) {
      return NextResponse.json({ erro: "Estoque inválido." }, { status: 400 });
    }

    let precoPromocionalNumero: number | null = null;

    if (
      preco_promocional !== null &&
      preco_promocional !== "" &&
      preco_promocional !== undefined
    ) {
      precoPromocionalNumero = Number(preco_promocional);

      if (
        !Number.isFinite(precoPromocionalNumero) ||
        precoPromocionalNumero < 0
      ) {
        return NextResponse.json(
          { erro: "Preço promocional inválido." },
          { status: 400 },
        );
      }
    }

    if (em_promocao && precoPromocionalNumero === null) {
      return NextResponse.json(
        {
          erro: "Informe o preço promocional para ativar a promoção.",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(estoqueMinimoNumero) || estoqueMinimoNumero < 0) {
      return NextResponse.json(
        { erro: "Estoque mínimo inválido." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("atualizar_produto_admin", {
      p_produto_id: produtoId,
      p_nome: nome.trim(),
      p_descricao:
        typeof descricao === "string" && descricao.trim()
          ? descricao.trim()
          : null,
      p_categoria_id: categoriaIdNumero,
      p_preco: precoNumero,
      p_preco_promocional: precoPromocionalNumero,
      p_estoque: estoqueNumero,
      p_estoque_minimo: estoqueMinimoNumero,
      p_imagem_url:
        typeof imagem_url === "string" && imagem_url.trim()
          ? imagem_url.trim()
          : null,
      p_ativo: Boolean(ativo),
      p_destaque: Boolean(destaque),
      p_em_promocao: Boolean(em_promocao),
      p_permite_abaixo_minimo: permite_abaixo_minimo === true,
    });

    if (error) {
      console.error("Erro ao editar produto:", error);

      if (error.message.includes("PRODUTO_NAO_ENCONTRADO")) {
        return NextResponse.json(
          { erro: "Produto não encontrado." },
          { status: 404 },
        );
      }

      if (error.message.includes("ESTOQUE_INVALIDO")) {
        return NextResponse.json(
          { erro: "Estoque inválido." },
          { status: 400 },
        );
      }
      if (error.message.includes("ESTOQUE_MINIMO_INVALIDO")) {
        return NextResponse.json(
          { erro: "Estoque mínimo inválido." },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { erro: "Não foi possível atualizar o produto." },
        { status: 500 },
      );
    }

    const produto = Array.isArray(data) ? data[0] : data;

    if (!produto) {
      return NextResponse.json(
        { erro: "O produto não retornou os dados esperados." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      produto,
    });
  } catch (error) {
    console.error("Erro na edição do produto:", error);

    return NextResponse.json(
      { erro: "Erro interno ao atualizar o produto." },
      { status: 500 },
    );
  }
}

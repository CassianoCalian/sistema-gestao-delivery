import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";

export async function POST(request: Request) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();

    const {
      codigo_barras,
      categoria_id,
      nome,
      descricao,
      preco,
      preco_promocional,
      estoque,
      estoque_minimo,
      unidades_por_item,
      imagem_url,
      ativo,
      em_promocao,
      permite_abaixo_minimo,
      opcoes,
    } = body;

    const categoriaIdNumero = Number(categoria_id);
    const unidadesPorItemNumero =
      unidades_por_item === undefined || unidades_por_item === ""
        ? 0
        : Number(unidades_por_item);

    if (!Number.isInteger(unidadesPorItemNumero) || unidadesPorItemNumero < 0) {
      return NextResponse.json(
        {
          erro: "Unidades de opções por item deve ser um número inteiro igual ou maior que 0.",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(categoriaIdNumero) || categoriaIdNumero <= 0) {
      return NextResponse.json(
        { erro: "Selecione uma categoria válida." },
        { status: 400 },
      );
    }

    const { data: categoria } = await supabaseAdmin
      .from("categorias")
      .select("id, nome, slug, ativo")
      .eq("id", categoriaIdNumero)
      .eq("ativo", true)
      .maybeSingle();

    if (!categoria) {
      return NextResponse.json(
        { erro: "A categoria selecionada não existe ou está inativa." },
        { status: 400 },
      );
    }

    if (categoria.slug === "promocoes") {
      return NextResponse.json(
        {
          erro: "Promoções não deve ser usada como categoria do produto.",
        },
        { status: 400 },
      );
    }

    /*
     * Código de barras é opcional.
     * Assim ainda conseguimos cadastrar manualmente
     * um produto que não tenha código.
     */
    const codigoLimpo =
      typeof codigo_barras === "string" ? codigo_barras.replace(/\D/g, "") : "";

    if (codigoLimpo && (codigoLimpo.length < 8 || codigoLimpo.length > 14)) {
      return NextResponse.json(
        { erro: "Código de barras inválido." },
        { status: 400 },
      );
    }

    /*
     * Antes de cadastrar, verificamos se o código
     * já pertence a outro produto.
     */
    if (codigoLimpo) {
      const { data: produtoExistente } = await supabaseAdmin
        .from("produtos")
        .select("id, nome")
        .eq("codigo_barras", codigoLimpo)
        .maybeSingle();

      if (produtoExistente) {
        return NextResponse.json(
          {
            erro: `Este código de barras já está cadastrado no produto "${produtoExistente.nome}".`,
          },
          { status: 409 },
        );
      }
    }

    if (typeof nome !== "string" || !nome.trim()) {
      return NextResponse.json(
        { erro: "Informe o nome do produto." },
        { status: 400 },
      );
    }
    const opcoesNormalizadas = Array.isArray(opcoes)
      ? opcoes
          .filter((opcao): opcao is string => typeof opcao === "string")
          .map((opcao) => opcao.trim())
          .filter(Boolean)
          .filter(
            (opcao, indice, lista) =>
              lista.findIndex(
                (item) => item.toLowerCase() === opcao.toLowerCase(),
              ) === indice,
          )
      : [];

    if (opcoesNormalizadas.some((opcao) => opcao.length > 60)) {
      return NextResponse.json(
        {
          erro: "Cada sabor/opção deve ter no máximo 60 caracteres.",
        },
        { status: 400 },
      );
    }

    if (opcoesNormalizadas.length > 30) {
      return NextResponse.json(
        {
          erro: "Um produto pode ter no máximo 30 sabores/opções.",
        },
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
    if (!Number.isInteger(estoqueMinimoNumero) || estoqueMinimoNumero < 0) {
      return NextResponse.json(
        { erro: "Estoque mínimo inválido." },
        { status: 400 },
      );
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

    if (
      precoPromocionalNumero !== null &&
      precoPromocionalNumero >= precoNumero
    ) {
      return NextResponse.json(
        {
          erro: "O preço promocional deve ser menor que o preço normal.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc("cadastrar_produto_admin", {
      p_codigo_barras: codigoLimpo,
      p_categoria_id: categoriaIdNumero,
      p_nome: nome.trim(),
      p_descricao:
        typeof descricao === "string" && descricao.trim()
          ? descricao.trim()
          : null,
      p_preco: precoNumero,
      p_preco_promocional: precoPromocionalNumero,
      p_estoque_inicial: estoqueNumero,
      p_estoque_minimo: estoqueMinimoNumero,
      p_imagem_url:
        typeof imagem_url === "string" && imagem_url.trim()
          ? imagem_url.trim()
          : null,
      p_ativo: Boolean(ativo),
      p_em_promocao: Boolean(em_promocao),
      p_permite_abaixo_minimo: permite_abaixo_minimo === true,
    });

    if (error) {
      console.error("Erro ao cadastrar produto:", error);

      if (error.code === "23505") {
        return NextResponse.json(
          {
            erro: "Já existe um produto com esse código de barras.",
          },
          { status: 409 },
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
        {
          erro: "Não foi possível cadastrar o produto.",
        },
        { status: 500 },
      );
    }

    const produto = Array.isArray(data) ? data[0] : data;

    if (!produto) {
      return NextResponse.json(
        {
          erro: "O cadastro não retornou os dados esperados.",
        },
        { status: 500 },
      );
    }

    const { error: erroUnidadesPorItem } = await supabaseAdmin
      .from("produtos")
      .update({
        unidades_por_item: unidadesPorItemNumero,
      })
      .eq("id", produto.id);

    if (erroUnidadesPorItem) {
      console.error(
        "Erro ao salvar unidades de opções por item:",
        erroUnidadesPorItem,
      );

      return NextResponse.json(
        {
          erro: "O produto foi cadastrado, mas não foi possível salvar a quantidade de opções por item.",
        },
        { status: 500 },
      );
    }

    if (opcoesNormalizadas.length > 0) {
      const opcoesParaCadastrar = opcoesNormalizadas.map(
        (nomeOpcao, indice) => ({
          produto_id: produto.id,
          nome: nomeOpcao,
          ativo: true,
          ordem: indice,
        }),
      );

      const { error: erroOpcoes } = await supabaseAdmin
        .from("produto_opcoes")
        .insert(opcoesParaCadastrar);

      if (erroOpcoes) {
        console.error(
          "Erro ao cadastrar sabores/opções do produto:",
          erroOpcoes,
        );

        return NextResponse.json(
          {
            erro: "O produto foi cadastrado, mas não foi possível salvar os sabores/opções.",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      {
        sucesso: true,
        produto,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro ao cadastrar produto:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao cadastrar o produto.",
      },
      { status: 500 },
    );
  }
}

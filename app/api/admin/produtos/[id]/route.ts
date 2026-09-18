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
      unidades_por_item,
      imagem_url,
      ativo,
      destaque,
      em_promocao,
      permite_abaixo_minimo,
      categoria_id,
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

    const { error: erroUnidadesPorItem } = await supabaseAdmin
      .from("produtos")
      .update({
        unidades_por_item: unidadesPorItemNumero,
      })
      .eq("id", produtoId);

    if (erroUnidadesPorItem) {
      console.error(
        "Erro ao atualizar unidades de opções por item:",
        erroUnidadesPorItem,
      );

      return NextResponse.json(
        {
          erro: "O produto foi atualizado, mas não foi possível salvar a quantidade de opções por item.",
        },
        { status: 500 },
      );
    }

    const { data: opcoesExistentes, error: erroBuscarOpcoes } =
      await supabaseAdmin
        .from("produto_opcoes")
        .select("id, nome, ativo, ordem")
        .eq("produto_id", produtoId)
        .order("ativo", { ascending: false })
        .order("id", { ascending: true });

    if (erroBuscarOpcoes) {
      console.error(
        "Erro ao buscar opções existentes do produto:",
        erroBuscarOpcoes,
      );

      return NextResponse.json(
        {
          erro: "O produto foi atualizado, mas não foi possível atualizar os sabores/opções.",
        },
        { status: 500 },
      );
    }

    const chavesDesejadas = new Set(
      opcoesNormalizadas.map((opcao) => opcao.toLowerCase()),
    );

    for (const opcaoExistente of opcoesExistentes ?? []) {
      const chaveExistente = opcaoExistente.nome.trim().toLowerCase();

      if (opcaoExistente.ativo && !chavesDesejadas.has(chaveExistente)) {
        const { error: erroDesativar } = await supabaseAdmin
          .from("produto_opcoes")
          .update({
            ativo: false,
          })
          .eq("id", opcaoExistente.id);

        if (erroDesativar) {
          console.error("Erro ao remover opção do produto:", erroDesativar);

          return NextResponse.json(
            {
              erro: "O produto foi atualizado, mas não foi possível remover uma das opções.",
            },
            { status: 500 },
          );
        }
      }
    }

    for (const [indice, nomeOpcao] of opcoesNormalizadas.entries()) {
      const chaveOpcao = nomeOpcao.toLowerCase();

      const opcaoExistente = (opcoesExistentes ?? []).find(
        (opcao) => opcao.nome.trim().toLowerCase() === chaveOpcao,
      );

      if (opcaoExistente) {
        const { error: erroAtualizarOpcao } = await supabaseAdmin
          .from("produto_opcoes")
          .update({
            nome: nomeOpcao,
            ativo: true,
            ordem: indice,
          })
          .eq("id", opcaoExistente.id);

        if (erroAtualizarOpcao) {
          console.error(
            "Erro ao atualizar opção do produto:",
            erroAtualizarOpcao,
          );

          return NextResponse.json(
            {
              erro: "O produto foi atualizado, mas não foi possível atualizar uma das opções.",
            },
            { status: 500 },
          );
        }
      } else {
        const { error: erroCriarOpcao } = await supabaseAdmin
          .from("produto_opcoes")
          .insert({
            produto_id: produtoId,
            nome: nomeOpcao,
            ativo: true,
            ordem: indice,
          });

        if (erroCriarOpcao) {
          console.error("Erro ao adicionar opção ao produto:", erroCriarOpcao);

          return NextResponse.json(
            {
              erro: "O produto foi atualizado, mas não foi possível adicionar uma das opções.",
            },
            { status: 500 },
          );
        }
      }
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
export async function DELETE(_request: Request, { params }: RouteProps) {
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

    const { data: produtoExistente, error: erroBusca } = await supabaseAdmin
      .from("produtos")
      .select("id, nome, ativo")
      .eq("id", produtoId)
      .maybeSingle();

    if (erroBusca) {
      console.error("Erro ao localizar produto para exclusão:", erroBusca);

      return NextResponse.json(
        { erro: "Não foi possível localizar o produto." },
        { status: 500 },
      );
    }

    if (!produtoExistente) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 },
      );
    }

    if (!produtoExistente.ativo) {
      return NextResponse.json({
        sucesso: true,
        mensagem: "Produto já estava excluído.",
      });
    }

    const { error } = await supabaseAdmin
      .from("produtos")
      .update({
        ativo: false,
        destaque: false,
        em_promocao: false,
      })
      .eq("id", produtoId);

    if (error) {
      console.error("Erro ao excluir produto:", error);

      return NextResponse.json(
        { erro: "Não foi possível excluir o produto." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: "Produto excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro na exclusão do produto:", error);

    return NextResponse.json(
      { erro: "Erro interno ao excluir o produto." },
      { status: 500 },
    );
  }
}

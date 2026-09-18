import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

function gerarSlug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    return NextResponse.json(
      { erro: "Não autorizado." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const categoriaId = Number(id);

  if (
    !Number.isInteger(categoriaId) ||
    categoriaId <= 0
  ) {
    return NextResponse.json(
      { erro: "Categoria inválida." },
      { status: 400 },
    );
  }

  try {
    const corpo = await request.json();

    const nome =
      typeof corpo.nome === "string"
        ? corpo.nome.trim()
        : "";

    const descricao =
      typeof corpo.descricao === "string"
        ? corpo.descricao.trim()
        : "";

    const icone =
      typeof corpo.icone === "string" &&
      corpo.icone.trim()
        ? corpo.icone.trim()
        : "\u{1F6CD}\uFE0F";

    if (!nome) {
      return NextResponse.json(
        { erro: "Informe o nome da categoria." },
        { status: 400 },
      );
    }

    if (nome.length > 80) {
      return NextResponse.json(
        {
          erro: "O nome deve ter no máximo 80 caracteres.",
        },
        { status: 400 },
      );
    }

    if (descricao.length > 120) {
      return NextResponse.json(
        {
          erro: "A descrição deve ter no máximo 120 caracteres.",
        },
        { status: 400 },
      );
    }

    const slug = gerarSlug(nome);

    if (!slug) {
      return NextResponse.json(
        {
          erro: "Não foi possível gerar o endereço da categoria.",
        },
        { status: 400 },
      );
    }

    const { data: categoriaAtual } =
      await supabaseAdmin
        .from("categorias")
        .select("id")
        .eq("id", categoriaId)
        .maybeSingle();

    if (!categoriaAtual) {
      return NextResponse.json(
        { erro: "Categoria não encontrada." },
        { status: 404 },
      );
    }

    const { data: slugDuplicado } =
      await supabaseAdmin
        .from("categorias")
        .select("id")
        .eq("slug", slug)
        .neq("id", categoriaId)
        .limit(1)
        .maybeSingle();

    if (slugDuplicado) {
      return NextResponse.json(
        {
          erro: "Já existe outra categoria com esse nome.",
        },
        { status: 409 },
      );
    }

    const { data: categoria, error } =
      await supabaseAdmin
        .from("categorias")
        .update({
          nome,
          slug,
          icone,
          descricao:
            descricao || "Confira nossas opções",
        })
        .eq("id", categoriaId)
        .select(`
          id,
          nome,
          slug,
          icone,
          descricao,
          ativo,
          ordem
        `)
        .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            erro: "Já existe outra categoria com esse nome.",
          },
          { status: 409 },
        );
      }

      console.error(
        "Erro ao editar categoria:",
        error,
      );

      return NextResponse.json(
        {
          erro: "Não foi possível editar a categoria.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      categoria,
    });
  } catch (erro) {
    console.error(
      "Erro inesperado ao editar categoria:",
      erro,
    );

    return NextResponse.json(
      {
        erro: "Não foi possível editar a categoria.",
      },
      { status: 500 },
    );
  }
}

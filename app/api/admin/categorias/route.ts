import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";

function gerarSlug(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    return NextResponse.json(
      { erro: "Não autorizado." },
      { status: 401 },
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
        { erro: "O nome da categoria é muito longo." },
        { status: 400 },
      );
    }

    if (descricao.length > 120) {
      return NextResponse.json(
        { erro: "A descrição deve ter no máximo 120 caracteres." },
        { status: 400 },
      );
    }

    const slug = gerarSlug(nome);

    if (!slug) {
      return NextResponse.json(
        { erro: "Não foi possível gerar o endereço da categoria." },
        { status: 400 },
      );
    }

    const { data: categoriaExistente } =
      await supabaseAdmin
        .from("categorias")
        .select("id")
        .eq("slug", slug)
        .limit(1)
        .maybeSingle();

    if (categoriaExistente) {
      return NextResponse.json(
        { erro: "Essa categoria já existe." },
        { status: 409 },
      );
    }

    const { data: ultimaCategoria } =
      await supabaseAdmin
        .from("categorias")
        .select("ordem")
        .order("ordem", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    const proximaOrdem =
      Number(ultimaCategoria?.ordem ?? 0) + 1;

    const { data: categoria, error } =
      await supabaseAdmin
        .from("categorias")
        .insert({
          nome,
          slug,
          icone,
          descricao:
            descricao || "Confira nossas opções",
          ativo: true,
          ordem: proximaOrdem,
          imagem_url: null,
        })
        .select(
          `
            id,
            nome,
            slug,
            icone,
            descricao,
            ativo,
            ordem
          `,
        )
        .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { erro: "Essa categoria já existe." },
          { status: 409 },
        );
      }

      console.error(
        "Erro ao cadastrar categoria:",
        error,
      );

      return NextResponse.json(
        { erro: "Não foi possível cadastrar a categoria." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { categoria },
      { status: 201 },
    );
  } catch (erro) {
    console.error(
      "Erro inesperado ao cadastrar categoria:",
      erro,
    );

    return NextResponse.json(
      { erro: "Não foi possível cadastrar a categoria." },
      { status: 500 },
    );
  }
}

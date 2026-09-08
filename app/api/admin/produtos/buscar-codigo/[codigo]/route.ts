import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../../lib/supabase/requireAdmin";

type RouteProps = {
  params: Promise<{
    codigo: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const { codigo } = await params;

    const codigoLimpo = codigo.replace(/\D/g, "");

    if (!codigoLimpo || codigoLimpo.length < 8) {
      return NextResponse.json(
        { erro: "Código de barras inválido." },
        { status: 400 },
      );
    }

    // Primeiro verificamos se esse produto já está cadastrado.
    const { data: produtoExistente } = await supabaseAdmin
      .from("produtos")
      .select("id, nome, codigo_barras")
      .eq("codigo_barras", codigoLimpo)
      .maybeSingle();

    if (produtoExistente) {
      return NextResponse.json(
        {
          erro: "Este código de barras já está cadastrado.",
          produto_existente: produtoExistente,
        },
        { status: 409 },
      );
    }

    const campos = [
      "code",
      "product_name",
      "generic_name",
      "brands",
      "quantity",
      "categories",
      "image_front_url",
    ].join(",");

    const url =
      `https://world.openfoodfacts.org/api/v3/product/${codigoLimpo}` +
      `?product_type=all&cc=br&lc=pt&fields=${campos}`;

    const resposta = await fetch(url, {
      headers: {
        "User-Agent": "DepositoDoZe/1.0",
      },
      cache: "no-store",
    });

    if (resposta.status === 404) {
      return NextResponse.json(
        {
          encontrado: false,
          codigo_barras: codigoLimpo,
          mensagem:
            "Produto não encontrado na base. Você poderá cadastrá-lo manualmente.",
        },
        { status: 200 },
      );
    }

    if (!resposta.ok) {
      console.error(
        "Erro Open Food Facts:",
        resposta.status,
        resposta.statusText,
      );

      return NextResponse.json(
        {
          erro: "Não foi possível consultar a base de produtos.",
        },
        { status: 502 },
      );
    }

    const dados = await resposta.json();

    const produto = dados?.product;

    if (!produto) {
      return NextResponse.json({
        encontrado: false,
        codigo_barras: codigoLimpo,
        mensagem: "Produto não encontrado. Preencha os dados manualmente.",
      });
    }

    const nome = produto.product_name || produto.generic_name || "";

    const descricao = [produto.brands, produto.quantity]
      .filter(Boolean)
      .join(" - ");

    return NextResponse.json({
      encontrado: true,

      produto: {
        codigo_barras: codigoLimpo,
        nome,
        descricao,
        marca: produto.brands || "",
        quantidade: produto.quantity || "",
        categoria: produto.categories || "",
        imagem_url: produto.image_front_url || "",
      },
    });
  } catch (error) {
    console.error("Erro ao buscar código de barras:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao buscar produto.",
      },
      {
        status: 500,
      },
    );
  }
}

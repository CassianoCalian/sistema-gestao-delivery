import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

export async function POST(request: Request) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const formData = await request.formData();

    const arquivo = formData.get("arquivo");

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { erro: "Selecione uma imagem." },
        { status: 400 },
      );
    }

    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];

    if (!tiposPermitidos.includes(arquivo.type)) {
      return NextResponse.json(
        {
          erro: "Formato inválido. Use JPG, PNG ou WEBP.",
        },
        { status: 400 },
      );
    }

    const tamanhoMaximo = 5 * 1024 * 1024;

    if (arquivo.size > tamanhoMaximo) {
      return NextResponse.json(
        {
          erro: "A imagem deve ter no máximo 5 MB.",
        },
        { status: 400 },
      );
    }

    const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";

    const nomeArquivo = `${Date.now()}-${crypto.randomUUID()}.${extensao}`;

    const caminho = `produtos/${nomeArquivo}`;

    const arrayBuffer = await arquivo.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer);

    const { error: erroUpload } = await supabaseAdmin.storage
      .from("Produtos")
      .upload(caminho, buffer, {
        contentType: arquivo.type,
        upsert: false,
      });

    if (erroUpload) {
      console.error("Erro ao enviar imagem:", erroUpload);

      return NextResponse.json(
        {
          erro: "Não foi possível enviar a imagem.",
        },
        { status: 500 },
      );
    }

    const { data } = supabaseAdmin.storage
      .from("Produtos")
      .getPublicUrl(caminho);

    return NextResponse.json({
      sucesso: true,
      imagem_url: data.publicUrl,
      caminho,
    });
  } catch (error) {
    console.error("Erro no upload da imagem:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao enviar a imagem.",
      },
      { status: 500 },
    );
  }
}

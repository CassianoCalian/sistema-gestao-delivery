import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

type VinculoRecebido = {
  produto_id?: number;
  quantidade_por_venda?: number;
};

export async function POST(request: Request) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();

    const estoqueId =
      body.estoque_id === null ||
      body.estoque_id === undefined ||
      body.estoque_id === ""
        ? null
        : Number(body.estoque_id);

    const nome = typeof body.nome === "string" ? body.nome.trim() : "";

    const quantidadeTotal = Number(body.quantidade_total);

    const vinculos: VinculoRecebido[] = Array.isArray(body.vinculos)
      ? body.vinculos
      : [];

    if (
      estoqueId !== null &&
      (!Number.isInteger(estoqueId) || estoqueId <= 0)
    ) {
      return NextResponse.json(
        { erro: "Estoque compartilhado inválido." },
        { status: 400 },
      );
    }

    if (!nome) {
      return NextResponse.json(
        { erro: "Informe o nome do estoque físico." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(quantidadeTotal) || quantidadeTotal < 0) {
      return NextResponse.json(
        { erro: "Informe uma quantidade física válida." },
        { status: 400 },
      );
    }

    const vinculosNormalizados = vinculos.map((vinculo) => ({
      produto_id: Number(vinculo.produto_id),
      quantidade_por_venda: Number(vinculo.quantidade_por_venda),
    }));

    if (
      vinculosNormalizados.some(
        (vinculo) =>
          !Number.isInteger(vinculo.produto_id) ||
          vinculo.produto_id <= 0 ||
          !Number.isInteger(vinculo.quantidade_por_venda) ||
          vinculo.quantidade_por_venda <= 0,
      )
    ) {
      return NextResponse.json(
        {
          erro: "Existe um vínculo de produto com quantidade inválida.",
        },
        { status: 400 },
      );
    }

    const ids = vinculosNormalizados.map((vinculo) => vinculo.produto_id);

    if (new Set(ids).size !== ids.length) {
      return NextResponse.json(
        {
          erro: "O mesmo produto não pode aparecer mais de uma vez no estoque.",
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin.rpc(
      "salvar_estoque_compartilhado_admin",
      {
        p_estoque_id: estoqueId,
        p_nome: nome,
        p_quantidade_total: quantidadeTotal,
        p_vinculos: vinculosNormalizados,
      },
    );

    if (error) {
      console.error("Erro ao salvar estoque compartilhado:", error);

      const mensagem = error.message ?? "";

      if (mensagem.includes("PRODUTO_JA_VINCULADO_OUTRO_ESTOQUE")) {
        return NextResponse.json(
          {
            erro: "Um dos produtos selecionados já pertence a outro estoque físico.",
          },
          { status: 400 },
        );
      }

      if (mensagem.includes("PRODUTO_NAO_ENCONTRADO")) {
        return NextResponse.json(
          { erro: "Um dos produtos não foi encontrado." },
          { status: 400 },
        );
      }

      if (
        mensagem.includes("NOME_ESTOQUE_INVALIDO") ||
        mensagem.includes("QUANTIDADE_ESTOQUE_INVALIDA") ||
        mensagem.includes("VINCULO_INVALIDO") ||
        mensagem.includes("VINCULOS_INVALIDOS")
      ) {
        return NextResponse.json(
          {
            erro: "Os dados informados para o estoque são inválidos.",
          },
          { status: 400 },
        );
      }

      if (mensagem.includes("ESTOQUE_COMPARTILHADO_NAO_ENCONTRADO")) {
        return NextResponse.json(
          { erro: "Estoque físico não encontrado." },
          { status: 404 },
        );
      }

      return NextResponse.json(
        { erro: "Não foi possível salvar o estoque físico." },
        { status: 500 },
      );
    }

    const resultado = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      sucesso: true,
      estoque: resultado,
    });
  } catch (error) {
    console.error("Erro interno ao salvar estoque compartilhado:", error);

    return NextResponse.json(
      { erro: "Erro interno ao salvar o estoque físico." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";

function normalizarTelefone(valor: string) {
  let telefone = valor.replace(/\D/g, "");

  if (
    (telefone.length === 12 || telefone.length === 13) &&
    telefone.startsWith("55")
  ) {
    telefone = telefone.slice(2);
  }

  return telefone;
}

export async function POST(request: Request) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    return NextResponse.json(
      {
        erro: "Não autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const body = (await request.json()) as {
      nome?: string;
      telefone?: string;
    };

    const nome = body.nome?.trim() ?? "";
    const telefone = body.telefone?.trim() ?? "";
    const telefoneNormalizado = normalizarTelefone(telefone);

    if (!nome) {
      return NextResponse.json(
        {
          erro: "Informe o nome do cliente.",
        },
        {
          status: 400,
        },
      );
    }

    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
      return NextResponse.json(
        {
          erro: "Informe um telefone válido com DDD.",
        },
        {
          status: 400,
        },
      );
    }

    const { data: clienteExistente, error: erroBusca } = await supabaseAdmin
      .from("clientes")
      .select(
        `
        id,
        nome,
        telefone,
        telefone_normalizado
      `,
      )
      .eq("telefone_normalizado", telefoneNormalizado)
      .maybeSingle();

    if (erroBusca) {
      console.error("Erro ao procurar cliente do PDV:", erroBusca);

      return NextResponse.json(
        {
          erro: "Não foi possível verificar o cliente.",
        },
        {
          status: 500,
        },
      );
    }

    if (clienteExistente) {
      return NextResponse.json({
        sucesso: true,
        cliente: clienteExistente,
        ja_existia: true,
      });
    }

    const { data: novoCliente, error: erroCadastro } = await supabaseAdmin
      .from("clientes")
      .insert({
        nome,
        telefone,
      })
      .select(
        `
        id,
        nome,
        telefone,
        telefone_normalizado
      `,
      )
      .single();

    if (erroCadastro) {
      console.error("Erro ao cadastrar cliente no PDV:", erroCadastro);

      return NextResponse.json(
        {
          erro: "Não foi possível cadastrar o cliente.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      sucesso: true,
      cliente: novoCliente,
      ja_existia: false,
    });
  } catch (error) {
    console.error("Erro inesperado no cadastro de cliente:", error);

    return NextResponse.json(
      {
        erro: "Erro inesperado ao cadastrar cliente.",
      },
      {
        status: 500,
      },
    );
  }
}

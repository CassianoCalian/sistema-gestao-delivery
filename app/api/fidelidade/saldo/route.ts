import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function normalizarTelefone(telefone: string) {
  let numeros = telefone.replace(/\D/g, "");

  if (
    (numeros.length === 12 || numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    numeros = numeros.slice(2);
  }

  return numeros;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const telefone =
      typeof body?.telefone === "string" ? body.telefone.trim() : "";

    const telefoneNormalizado = normalizarTelefone(telefone);

    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
      return NextResponse.json(
        {
          erro: "Informe um WhatsApp válido.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const { data: cliente, error } = await supabaseAdmin
      .from("clientes")
      .select(
        `
          id,
          pontos_saldo,
          fidelidade_progresso_centavos
        `,
      )
      .eq("telefone_normalizado", telefoneNormalizado)
      .maybeSingle();

    if (error) {
      console.error("Erro ao consultar fidelidade:", error);

      return NextResponse.json(
        {
          erro: "Não foi possível consultar seus pontos.",
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (!cliente) {
      return NextResponse.json(
        {
          encontrado: false,
          pontos_saldo: 0,
          progresso_centavos: 0,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(
      {
        encontrado: true,

        pontos_saldo: Number(cliente.pontos_saldo ?? 0),

        progresso_centavos: Number(cliente.fidelidade_progresso_centavos ?? 0),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado ao consultar fidelidade:", error);

    return NextResponse.json(
      {
        erro: "Não foi possível consultar seus pontos.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

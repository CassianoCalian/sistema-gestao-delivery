import { createHmac } from "crypto";
import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMITE_IP = 30;
const JANELA_IP_SEGUNDOS = 10 * 60;

type ResultadoRateLimit = {
  permitido: boolean;
  total_tentativas: number;
  tentar_novamente_em: number;
};

const LIMITE_TELEFONE = 12;
const JANELA_TELEFONE_SEGUNDOS = 15 * 60;

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

function obterIp(request: Request) {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for");

  if (vercelForwardedFor) {
    return vercelForwardedFor.split(",")[0]?.trim() || "desconhecido";
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "desconhecido";
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  return "desconhecido";
}

function criarHash(valor: string) {
  const segredo = process.env.FIDELIDADE_RATE_LIMIT_SECRET;

  if (!segredo || segredo.length < 32) {
    throw new Error("FIDELIDADE_RATE_LIMIT_SECRET_NAO_CONFIGURADO");
  }

  return createHmac("sha256", segredo).update(valor).digest("hex");
}

async function verificarRateLimit(
  chave: string,
  limite: number,
  janelaSegundos: number,
) {
  const { data, error } = await supabaseAdmin
    .rpc("verificar_limite_consulta_fidelidade", {
      p_chave: chave,
      p_limite: limite,
      p_janela_segundos: janelaSegundos,
    })
    .single();

  if (error) {
    throw error;
  }

  const resultado = data as ResultadoRateLimit | null;

  if (!resultado) {
    throw new Error("RATE_LIMIT_SEM_RESPOSTA");
  }

  return {
    permitido: resultado.permitido === true,
    tentarNovamenteEm: Number(resultado.tentar_novamente_em ?? janelaSegundos),
  };
}

function respostaRateLimit(tentarNovamenteEm: number) {
  return NextResponse.json(
    {
      erro: "Muitas consultas foram realizadas. Tente novamente em alguns minutos.",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(Math.max(1, tentarNovamenteEm)),
      },
    },
  );
}

export async function POST(request: Request) {
  try {
    // =========================================================
    // 1. RATE LIMIT POR IP
    // =========================================================

    const ip = obterIp(request);

    const chaveIp = `ip:${criarHash(ip)}`;

    const limiteIp = await verificarRateLimit(
      chaveIp,
      LIMITE_IP,
      JANELA_IP_SEGUNDOS,
    );

    if (!limiteIp.permitido) {
      return respostaRateLimit(limiteIp.tentarNovamenteEm);
    }

    // =========================================================
    // 2. VALIDAÇÃO DO TELEFONE
    // =========================================================

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          erro: "Os dados enviados são inválidos.",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const telefone =
      typeof body === "object" &&
      body !== null &&
      "telefone" in body &&
      typeof body.telefone === "string"
        ? body.telefone.trim()
        : "";

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

    // =========================================================
    // 3. RATE LIMIT POR TELEFONE
    // =========================================================

    const chaveTelefone = `telefone:${criarHash(telefoneNormalizado)}`;

    const limiteTelefone = await verificarRateLimit(
      chaveTelefone,
      LIMITE_TELEFONE,
      JANELA_TELEFONE_SEGUNDOS,
    );

    if (!limiteTelefone.permitido) {
      return respostaRateLimit(limiteTelefone.tentarNovamenteEm);
    }

    // =========================================================
    // 4. CONSULTA DA FIDELIDADE
    // =========================================================

    const { data: cliente, error } = await supabaseAdmin
      .from("clientes")
      .select(
        `
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

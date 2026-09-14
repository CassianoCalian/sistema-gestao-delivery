import { createHmac } from "crypto";

import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMITE_IP = 30;
const JANELA_IP_SEGUNDOS = 10 * 60;

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

type ResultadoRateLimit = {
  permitido: boolean;
  total_tentativas: number;
  tentar_novamente_em: number;
};

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

function respostaJson(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cep: string }> },
) {
  try {
    const ip = obterIp(request);

    const limiteIp = await verificarRateLimit(
      `cep:ip:${criarHash(ip)}`,
      LIMITE_IP,
      JANELA_IP_SEGUNDOS,
    );

    if (!limiteIp.permitido) {
      return respostaJson(
        {
          erro: "Muitas consultas de CEP foram realizadas. Tente novamente em alguns minutos.",
        },
        429,
        {
          "Retry-After": String(Math.max(1, limiteIp.tentarNovamenteEm)),
        },
      );
    }

    const { cep } = await params;

    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      return respostaJson(
        {
          erro: "CEP inválido. Informe os 8 números do CEP.",
        },
        400,
      );
    }

    const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!resposta.ok) {
      return respostaJson(
        {
          erro: "Não foi possível consultar o CEP.",
        },
        502,
      );
    }

    let endereco: ViaCepResponse;

    try {
      endereco = (await resposta.json()) as ViaCepResponse;
    } catch {
      return respostaJson(
        {
          erro: "Não foi possível consultar o CEP.",
        },
        502,
      );
    }

    if (endereco.erro) {
      return respostaJson(
        {
          erro: "CEP não encontrado.",
        },
        404,
      );
    }

    return respostaJson({
      cep: endereco.cep ?? "",
      rua: endereco.logradouro ?? "",
      bairro: endereco.bairro ?? "",
      cidade: endereco.localidade ?? "",
      uf: endereco.uf ?? "",
    });
  } catch (error) {
    console.error("Erro ao consultar CEP:", error);

    return respostaJson(
      {
        erro: "Não foi possível consultar o CEP neste momento.",
      },
      500,
    );
  }
}

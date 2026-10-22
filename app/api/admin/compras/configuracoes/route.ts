import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Configuracao = {
  chave: string;
  fornecedor: string;
  estoque_minimo: number | null;
};

const fornecedores = new Set([
  "Nao definido", "Valtinho", "Barzil", "Outro",
]);

const chaveValida = /^(produto|fisico):[1-9][0-9]{0,17}$/;

function resposta(dados: unknown, status = 200) {
  return NextResponse.json(dados, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function autorizar() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await autorizar())) {
    return resposta({ erro: "Nao autorizado." }, 401);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("compras_configuracoes_ia")
      .select("chave,fornecedor,estoque_minimo,atualizado_em")
      .order("chave")
      .limit(501);

    if (error || !data || data.length > 500) {
      throw new Error("Consulta incompleta.");
    }

    return resposta({ configuracoes: data });
  } catch (erro) {
    console.error("COMPRAS_CONFIG_GET", erro);
    return resposta({
      erro: "Nao foi possivel carregar as configuracoes salvas.",
    }, 503);
  }
}

export async function POST(request: Request) {
  if (!(await autorizar())) {
    return resposta({ erro: "Nao autorizado." }, 401);
  }

  try {
    const texto = await request.text();

    if (texto.length > 65000) {
      return resposta({ erro: "Requisicao muito grande." }, 413);
    }

    const corpo = JSON.parse(texto) as {
      itens?: Configuracao[];
    };

    if (
      !corpo ||
      !Array.isArray(corpo.itens) ||
      corpo.itens.length < 1 ||
      corpo.itens.length > 250
    ) {
      return resposta({ erro: "Lista de configuracoes invalida." }, 400);
    }

    const chaves = new Set<string>();

    for (const item of corpo.itens) {
      if (
        !item ||
        typeof item.chave !== "string" ||
        !chaveValida.test(item.chave) ||
        chaves.has(item.chave) ||
        !fornecedores.has(item.fornecedor) ||
        (
          item.estoque_minimo !== null &&
          (
            !Number.isSafeInteger(item.estoque_minimo) ||
            item.estoque_minimo < 0 ||
            item.estoque_minimo > 10000
          )
        )
      ) {
        return resposta({
          erro: "Configuracao invalida ou repetida.",
        }, 400);
      }

      chaves.add(item.chave);
    }

    const agora = new Date().toISOString();

    const registros = corpo.itens.map((item) => ({
      chave: item.chave,
      fornecedor: item.fornecedor,
      estoque_minimo: item.estoque_minimo,
      atualizado_em: agora,
    }));

    const { data, error } = await supabaseAdmin
      .from("compras_configuracoes_ia")
      .upsert(registros, { onConflict: "chave" })
      .select("chave");

    if (error || data?.length !== registros.length) {
      throw new Error("Nao foi possivel confirmar a gravacao.");
    }

    return resposta({
      sucesso: true,
      quantidade: registros.length,
    });
  } catch (erro) {
    console.error("COMPRAS_CONFIG_POST", erro);
    return resposta({
      erro: "Falha ao salvar. Revise as configuracoes.",
    }, 503);
  }
}
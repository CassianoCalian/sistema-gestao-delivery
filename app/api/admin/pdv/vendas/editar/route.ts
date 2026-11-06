import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function erro(mensagem: string, status = 400) {
  return NextResponse.json({ sucesso: false, erro: mensagem },
    { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return erro("Acesso nao autorizado.", 401);
  }

  const id = Number(new URL(request.url).searchParams.get("id"));

  if (!Number.isSafeInteger(id) || id <= 0)
    return erro("Venda invalida.");

  const [vendaR, itensR] = await Promise.all([
    supabaseAdmin.from("pdv_vendas")
      .select("id,turno_id,status,total,forma_pagamento,tipo_atendimento,dados_entrega")
      .eq("id", id).maybeSingle(),
    supabaseAdmin.from("pdv_venda_itens")
      .select("nome_produto,quantidade,preco_unitario,subtotal")
      .eq("venda_id", id)
      .order("id", { ascending: true }),
  ]);

  if (vendaR.error || itensR.error)
    return erro("Nao foi possivel consultar esta venda.", 500);

  if (!vendaR.data)
    return erro("Venda nao encontrada.", 404);

  return NextResponse.json({
    sucesso: true,
    venda: vendaR.data,
    itens: itensR.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let usuario: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    usuario = await requireAdmin();
  } catch {
    return erro("Acesso nao autorizado.", 401);
  }

  if (!usuario.email)
    return erro("Operador sem identificacao.", 403);

  const origem = request.headers.get("origin");

  if (!origem || new URL(origem).host !== new URL(request.url).host)
    return erro("Origem invalida.", 403);

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body))
      return erro("Dados invalidos.");

    const entrada = body as {
      venda_id?: unknown;
      tipo?: unknown;
      dados_entrega?: unknown;
    };

    const id = entrada.venda_id;

    if (!Number.isSafeInteger(id) || Number(id) <= 0 ||
        (entrada.tipo !== "balcao" && entrada.tipo !== "delivery"))
      return erro("Venda ou canal invalido.");

    let endereco: Record<string, string> | null = null;

    if (entrada.tipo === "delivery") {
      const dados = entrada.dados_entrega;

      if (!dados || typeof dados !== "object" || Array.isArray(dados))
        return erro("Informe o endereco.");

      const bruto = dados as Record<string, unknown>;
      endereco = {};

      for (const chave of [
        "nome", "telefone", "cep", "rua", "numero",
        "complemento", "bairro", "referencia", "observacao"
      ]) {
        const valor = bruto[chave] ?? "";

        if (typeof valor !== "string" || valor.length > 250)
          return erro("Campo invalido: " + chave);

        endereco[chave] = valor.trim();
      }

      if (!endereco.rua || !endereco.numero)
        return erro("Rua e numero sao obrigatorios.");

      if (endereco.cep &&
          !/^\d{8}$/.test(endereco.cep.replace(/\D/g, "")))
        return erro("CEP precisa ter 8 digitos.");
    }

    const { error } = await supabaseAdmin.rpc("pdv_alterar_canal_venda", {
      p_venda_id: id as number,
      p_tipo: entrada.tipo,
      p_dados_entrega: endereco,
      p_operador_email: usuario.email,
    });

    if (error) {
      console.error("Edicao de canal PDV:", error);

      if (error.code === "PGRST202")
        return erro("Atualizacao SQL pendente no Supabase.", 503);

      if (error.message.includes("TURNO_ENCERRADO"))
        return erro("O turno ja foi encerrado.", 409);

      if (error.message.includes("VENDA_NAO_EDITAVEL"))
        return erro("Venda cancelada ou nao editavel.", 409);

      if (error.message.includes("ENDERECO_INVALIDO"))
        return erro("Informe rua e numero validos.");

      return erro("Nao foi possivel mudar o canal.", 409);
    }

    return NextResponse.json({ sucesso: true },
      { headers: { "Cache-Control": "no-store" } });

  } catch (e) {
    console.error("Edicao do canal:", e);
    return erro("Falha ao editar venda.", 500);
  }
}
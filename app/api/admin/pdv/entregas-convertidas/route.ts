import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function autorizado() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET() {
  const usuario = await autorizado();
  if (!usuario) {
    return NextResponse.json({ erro: "Nao autorizado" }, { status: 401 });
  }

  const r = await supabaseAdmin.from("pdv_vendas")
    .select("id,created_at,total,forma_pagamento,dados_entrega")
    .eq("tipo_atendimento", "delivery")
    .eq("status", "concluida")
    .order("created_at", { ascending: false })
    .limit(100);

  if (r.error) {
    return NextResponse.json({ erro: "Erro ao consultar entregas" }, { status: 500 });
  }

  const vendas = r.data ?? [];
  const ids = vendas.map(v => v.id);

  const itens = ids.length
    ? await supabaseAdmin.from("pdv_venda_itens")
      .select("venda_id,nome_produto,quantidade,subtotal")
      .in("venda_id", ids)
    : null;

  if (itens?.error) {
    return NextResponse.json({ erro: "Erro ao consultar produtos" }, { status: 500 });
  }

  return NextResponse.json({
    entregas: vendas,
    itens: itens?.data ?? []
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const usuario = await autorizado();

  if (!usuario?.email) {
    return NextResponse.json({ erro: "Nao autorizado" }, { status: 401 });
  }

  const origem = request.headers.get("origin");
  if (!origem || new URL(origem).host !== new URL(request.url).host) {
    return NextResponse.json({ erro: "Origem invalida" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = body?.venda_id;
    const status = body?.status;

    if (!Number.isSafeInteger(id) || id <= 0 ||
        !["em_preparacao", "saiu_entrega", "entregue"].includes(status)) {
      return NextResponse.json({ erro: "Dados invalidos" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.rpc("pdv_entrega_alterar_status", {
      p_venda_id: id,
      p_status: status,
      p_operador_email: usuario.email
    });

    if (error) {
      console.error("Falha ao atualizar entrega convertida:", error);
      return NextResponse.json({
        erro: error.code === "PGRST202"
          ? "Atualizacao SQL pendente"
          : "Nao foi possivel atualizar esta entrega"
      }, { status: 409 });
    }

    return NextResponse.json({ sucesso: true });
  } catch {
    return NextResponse.json({ erro: "Falha na operacao" }, { status: 500 });
  }
}
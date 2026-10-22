import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(dados: object, status = 200) {
  return NextResponse.json(dados, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return json({ erro: "Nao autorizado" }, 401);
  }

  try {
    const { data: caixa, error: ec } = await supabaseAdmin
      .from("pdv_caixas")
      .select("id")
      .eq("codigo", "principal")
      .maybeSingle();

    if (ec || !caixa) {
      return json({ erro: "Caixa indisponivel" }, 503);
    }

    const { data: turno, error: et } = await supabaseAdmin
      .from("pdv_turnos")
      .select("id,aberto_em")
      .eq("caixa_id", caixa.id)
      .eq("status", "aberto")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (et) {
      return json({ erro: "Falha ao consultar turno" }, 503);
    }

    if (!turno) {
      return json({
        sucesso: true,
        turno: null,
        balcao: 0,
        entregas: 0,
      });
    }

    const [vb, pe] = await Promise.all([
      supabaseAdmin
        .from("pdv_vendas")
        .select("id", { count: "exact", head: true })
        .eq("turno_id", turno.id)
        .eq("status", "concluida"),

      supabaseAdmin
        .from("pedidos")
        .select("id", { count: "exact", head: true })
        .gte("created_at", turno.aberto_em)
        .neq("status", "cancelado"),
    ]);

    if (
      vb.error ||
      pe.error ||
      vb.count === null ||
      pe.count === null
    ) {
      return json({ erro: "Contagem indisponivel" }, 503);
    }

    return json({
      sucesso: true,
      turno: turno.id,
      balcao: vb.count,
      entregas: pe.count,
    });
  } catch (erro) {
    console.error("Falha no contador do PDV:", erro);
    return json({ erro: "Contagem indisponivel" }, 503);
  }
}
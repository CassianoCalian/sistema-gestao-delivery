import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ erro: "Nao autorizado" }, { status: 401 });
  }

  const termo = (new URL(request.url).searchParams.get("q") || "")
    .trim().replace(/[%_,()*]/g, "").slice(0, 60);

  if (termo.length < 2) {
    return NextResponse.json({ clientes: [] });
  }

  const nomeR = await supabaseAdmin.from("clientes")
    .select("id,nome,telefone")
    .ilike("nome", `%${termo}%`)
    .limit(10);

  if (nomeR.error) {
    return NextResponse.json({ erro: "Falha na busca" }, { status: 500 });
  }

  let clientes = nomeR.data ?? [];
  const telefone = termo.replace(/\D/g, "");

  if (telefone.length >= 3) {
    const telR = await supabaseAdmin.from("clientes")
      .select("id,nome,telefone")
      .ilike("telefone_normalizado", `%${telefone}%`)
      .limit(10);

    if (telR.error) {
      return NextResponse.json({ erro: "Falha na busca" }, { status: 500 });
    }

    clientes = [...clientes, ...(telR.data ?? [])];
  }

  return NextResponse.json({
    clientes: Array.from(
      new Map(clientes.map(c => [c.id, c])).values()
    ).slice(0, 10)
  }, { headers: { "Cache-Control": "private, no-store" } });
}
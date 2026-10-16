import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json(
        { erro: "Não autorizado." },
        {
          status: 401,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const parametro = new URL(request.url).searchParams.get("depois");

    const depois = Number(parametro);

    if (parametro === null || !Number.isSafeInteger(depois) || depois < 0) {
      return NextResponse.json(
        { erro: "Identificador inválido." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("id, status")
      .gt("id", depois)
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Erro ao consultar alertas:", error);

      return NextResponse.json(
        { erro: "Não foi possível consultar pedidos." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        pedidos: data ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Erro no monitor de pedidos:", error);

    return NextResponse.json(
      { erro: "Erro interno ao verificar pedidos." },
      { status: 500 },
    );
  }
}

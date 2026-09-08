import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar último pedido:", error);

      return NextResponse.json(
        { erro: "Não foi possível verificar os pedidos." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ultimoPedidoId: data?.id ?? 0,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Erro inesperado:", error);

    return NextResponse.json({ erro: "Erro interno." }, { status: 500 });
  }
}

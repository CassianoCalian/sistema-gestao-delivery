import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const autorizado = await verificarAdmin();

    if (!autorizado) {
      return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
    }

    const parametro = new URL(request.url).searchParams.get("depois");

    const depois = Number(parametro);

    if (parametro === null || !Number.isSafeInteger(depois) || depois < 0) {
      return NextResponse.json(
        { erro: "Identificador inválido." },
        { status: 400 },
      );
    }

    const limiteAtraso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const [novos, pendentes] = await Promise.all([
      supabaseAdmin
        .from("pedidos")
        .select("id, status, forma_pagamento, pagamento_confirmado")
        .gt("id", depois)
        .order("id", { ascending: true })
        .limit(100),

      supabaseAdmin
        .from("pedidos")
        .select("id, created_at, forma_pagamento, pagamento_confirmado")
        .eq("status", "recebido")

        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (novos.error || pendentes.error) {
      console.error("Erro no monitor de pedidos:", {
        novos: novos.error,
        pendentes: pendentes.error,
      });

      return NextResponse.json(
        { erro: "Falha ao consultar os pedidos." },
        { status: 500 },
      );
    }

    // Pix não confirmado não deve gerar aviso
    // para iniciar a preparação do pedido.
    const aguardando = (pendentes.data ?? []).filter(
      (pedido) =>
        pedido.forma_pagamento !== "pix" ||
        pedido.pagamento_confirmado === true,
    );

    const idsAguardando = aguardando
      .map((pedido) => Number(pedido.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    const atrasados = aguardando
      .filter((pedido) => pedido.created_at <= limiteAtraso)
      .map((pedido) => Number(pedido.id))
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    return NextResponse.json(
      {
        sucesso: true,
        pedidos: novos.data ?? [],
        aguardando: idsAguardando,
        atrasados,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Erro na API de alertas:", error);

    return NextResponse.json(
      { erro: "Erro interno no monitor." },
      { status: 500 },
    );
  }
}

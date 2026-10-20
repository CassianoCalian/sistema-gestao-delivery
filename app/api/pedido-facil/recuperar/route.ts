import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const chave =
      typeof body?.chave_idempotencia === "string"
        ? body.chave_idempotencia.trim()
        : "";

    const valida =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        chave,
      );

    if (!valida) {
      return NextResponse.json(
        { erro: "Identificador invalido." },
        { status: 400, headers },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("codigo_acesso")
      .eq("chave_idempotencia", chave)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { erro: "Falha ao consultar o pedido." },
        { status: 503, headers },
      );
    }

    if (!data) {
      return NextResponse.json(
        { encontrado: false },
        { headers },
      );
    }

    if (!data.codigo_acesso) {
      return NextResponse.json(
        { erro: "Codigo do pedido indisponivel." },
        { status: 503, headers },
      );
    }

    return NextResponse.json(
      {
        encontrado: true,
        codigo_acesso: data.codigo_acesso,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { erro: "Erro ao verificar pedido." },
      { status: 500, headers },
    );
  }
}
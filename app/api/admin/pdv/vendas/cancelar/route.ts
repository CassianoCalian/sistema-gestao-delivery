import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responder(erro: string, status: number) {
  return NextResponse.json(
    { sucesso: false, erro },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  let usuario: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    usuario = await requireAdmin();
  } catch {
    return responder("Acesso nao autorizado.", 401);
  }

  if (!usuario.email) {
    return responder("Operador sem identificacao.", 403);
  }

  const origem = request.headers.get("origin");

  if (!origem || new URL(origem).host !== new URL(request.url).host) {
    return responder("Origem da requisicao invalida.", 403);
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return responder("Dados invalidos.", 400);
    }

    const dados = body as {
      venda_id?: unknown;
      motivo?: unknown;
      reembolso_confirmado?: unknown;
    };

    if (
      !Number.isSafeInteger(dados.venda_id) ||
      Number(dados.venda_id) <= 0 ||
      typeof dados.motivo !== "string" ||
      dados.motivo.trim().length < 5 ||
      dados.motivo.length > 500 ||
      dados.reembolso_confirmado !== true
    ) {
      return responder("Confira os dados e o reembolso.", 400);
    }

    const { error } = await supabaseAdmin.rpc(
      "cancelar_venda_balcao_segura",
      {
        p_venda_id: dados.venda_id,
        p_operador_email: usuario.email,
        p_motivo: dados.motivo.trim(),
        p_reembolso_confirmado: true,
      }
    );

    if (error) {
      console.error("Cancelamento de venda do PDV:", error);

      if (error.message.includes("TURNO_ENCERRADO")) {
        return responder("O turno ja foi encerrado.", 409);
      }

      if (error.message.includes("CONFIG_ESTOQUE_ALTERADA")) {
        return responder(
          "O estoque mudou de configuracao. Cancelamento bloqueado para evitar divergencia.",
          409
        );
      }

      if (error.message.includes("VENDA_JA_CANCELADA")) {
        return responder("Venda ja cancelada.", 409);
      }

      return responder(
        "Nao foi possivel cancelar. Nenhuma alteracao parcial foi aplicada.",
        409
      );
    }

    return NextResponse.json(
      { sucesso: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return responder("Falha ao processar o cancelamento.", 500);
  }
}
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { resumirRecebimentosDelivery } from "../../../../../lib/recebimentosDelivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function falha(erro: string, status = 400) {
  return NextResponse.json({ erro }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request) {
  let usuario: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    usuario = await requireAdmin();
  } catch {
    return falha("Nao autorizado.", 401);
  }

  if (!usuario.email) {
    return falha("Operador invalido.", 403);
  }

  const origem = request.headers.get("origin");

  if (
    (origem && origem !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return falha("Origem nao autorizada.", 403);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return falha("Dados invalidos.");
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("pedido_id" in body) ||
    !Number.isSafeInteger(body.pedido_id) ||
    Number(body.pedido_id) <= 0
  ) {
    return falha("Informe um pedido valido.");
  }

  const pedidoId = Number(body.pedido_id);

  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from("pedidos")
    .select("id,total,status,forma_pagamento,pagamento_confirmado,pagamentos_detalhes")
    .eq("id", pedidoId)
    .maybeSingle();

  if (erroPedido) {
    return falha("Erro ao consultar pedido.", 500);
  }

  if (!pedido) {
    return falha(
      "Pedido nao encontrado. Vendas convertidas do PDV ja sao contabilizadas.",
      404
    );
  }

  if (pedido.status === "cancelado") {
    return falha("Pedido cancelado.", 409);
  }

  let dinheiro: number;

  try {
    dinheiro = resumirRecebimentosDelivery([pedido]).totais.dinheiro;
  } catch {
    return falha("Pagamento inconsistente. Confira o pedido.", 409);
  }

  if (!Number.isFinite(dinheiro) || dinheiro <= 0) {
    return falha(
      "Nao existe dinheiro confirmado. Confirme primeiro o pagamento do pedido.",
      409
    );
  }

  const hex = createHash("sha256")
    .update(`ze:recebimento-fisico-delivery:${pedidoId}`)
    .digest("hex");

  const chave =
    `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}` +
    `-a${hex.slice(17,20)}-${hex.slice(20,32)}`;

  const { data: existente, error: erroExistente } = await supabaseAdmin
    .from("pdv_caixa_movimentacoes")
    .select("id,turno_id")
    .eq("chave_idempotencia", chave)
    .maybeSingle();

  if (erroExistente) {
    return falha("Erro ao conferir lancamentos.", 500);
  }

  if (existente) {
    return falha(
      `Pedido ja lancado no turno #${existente.turno_id}.`,
      409
    );
  }

  const { data: caixa, error: erroCaixa } = await supabaseAdmin
    .from("pdv_caixas")
    .select("id")
    .eq("codigo", "principal")
    .maybeSingle();

  if (erroCaixa || !caixa) {
    return falha("Caixa indisponivel.", 500);
  }

  const { data: turno, error: erroTurno } = await supabaseAdmin
    .from("pdv_turnos")
    .select("id")
    .eq("caixa_id", caixa.id)
    .eq("status", "aberto")
    .maybeSingle();

  if (erroTurno || !turno) {
    return falha("Nao existe turno aberto.", 409);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "movimentar_caixa_pdv",
    {
      p_turno_id: turno.id,
      p_tipo: "suprimento",
      p_valor: dinheiro,
      p_motivo: `Dinheiro recebido fisicamente do delivery - pedido #${pedidoId}`,
      p_operador_uid: usuario.id,
      p_operador_email: usuario.email,
      p_chave: chave
    }
  );

  if (error) {
    return falha(
      "Falha ao registrar. Confira as movimentacoes antes de tentar novamente.",
      409
    );
  }

  return NextResponse.json({
    sucesso: true,
    id: data,
    pedido_id: pedidoId,
    valor: dinheiro
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}
import { notFound } from "next/navigation";
import Link from "next/link";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import OrderStatusButtons from "../../../../components/OrderStatusButtons";
import ConfirmPaymentButton from "../../../../components/ConfirmPaymentButton";
import PrintOrderButton from "../../../../components/PrintOrderButton";
import PrintableOrderReceipt from "../../../../components/PrintableOrderReceipt";

type AdminPedidoDetalheProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarDataHora(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

function formatarPagamento(forma: string) {
  if (forma === "pix") {
    return "PIX";
  }

  if (forma === "cartao_entrega") {
    return "Cartão na entrega";
  }

  if (forma === "dinheiro") {
    return "Dinheiro na entrega";
  }

  return forma;
}

function formatarStatus(status: string) {
  if (status === "recebido") {
    return "🟡 Pedido recebido";
  }

  if (status === "em_preparacao") {
    return "🟠 Em preparação";
  }

  if (status === "saiu_entrega") {
    return "🔵 Saiu para entrega";
  }

  if (status === "entregue") {
    return "🟢 Entregue";
  }

  if (status === "cancelado") {
    return "🔴 Cancelado";
  }

  return status;
}
function gerarMensagemStatus(pedidoId: number, status: string) {
  if (status === "recebido") {
    return `Olá! Aqui é do Depósito do Zé. Recebemos seu pedido #${pedidoId} com sucesso! Já já começaremos a preparação.`;
  }

  if (status === "em_preparacao") {
    return `Olá! Aqui é do Depósito do Zé. Seu pedido #${pedidoId} já está em preparação! Estamos separando tudo para você.`;
  }

  if (status === "saiu_entrega") {
    return `Olá! Aqui é do Depósito do Zé. Seu pedido #${pedidoId} saiu para entrega e já está a caminho!`;
  }

  if (status === "entregue") {
    return `Olá! Aqui é do Depósito do Zé. O pedido #${pedidoId} foi marcado como entregue. Obrigado pela preferência!`;
  }

  if (status === "cancelado") {
    return `Olá! Aqui é do Depósito do Zé. Precisamos falar com você sobre o cancelamento do pedido #${pedidoId}.`;
  }

  return `Olá! Aqui é do Depósito do Zé. Entramos em contato sobre o pedido #${pedidoId}.`;
}

function gerarLinkWhatsApp(telefone: string, pedidoId: number, status: string) {
  const telefoneLimpo = telefone.replace(/\D/g, "");

  const numeroWhatsApp = telefoneLimpo.startsWith("55")
    ? telefoneLimpo
    : `55${telefoneLimpo}`;

  const mensagem = gerarMensagemStatus(pedidoId, status);

  return `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensagem)}`;
}

export default async function AdminPedidoDetalhe({
  params,
}: AdminPedidoDetalheProps) {
  const { id } = await params;

  const pedidoId = Number(id);

  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    notFound();
  }

  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from("pedidos")
    .select(
      `
        id,
        codigo_acesso,
        created_at,
        nome_cliente,
        telefone,
        cep,
        rua,
        numero,
        complemento,
        bairro,
        referencia,
        forma_pagamento,
        troco_para,
       subtotal,
taxa_entrega,
taxa_cartao,
desconto_fidelidade,
pontos_fidelidade_usados,
total,
pagamento_confirmado,
        status
      `,
    )
    .eq("id", pedidoId)
    .single();

  if (erroPedido || !pedido) {
    notFound();
  }

  const linkWhatsApp = gerarLinkWhatsApp(
    pedido.telefone,
    pedido.id,
    pedido.status,
  );

  const { data: itens, error: erroItens } = await supabaseAdmin
    .from("itens_pedido")
    .select(
      `
        id,
        nome_produto,
        preco_unitario,
        quantidade,
        subtotal
      `,
    )
    .eq("pedido_id", pedidoId);

  const { data: historicoStatus, error: erroHistorico } = await supabaseAdmin
    .from("historico_status_pedidos")
    .select(
      `
      id,
      status_anterior,
      status_novo,
      created_at
    `,
    )
    .eq("pedido_id", pedidoId)
    .order("created_at", { ascending: true });

  if (erroHistorico) {
    console.error("Erro ao buscar histórico do pedido:", erroHistorico);
  }

  if (erroItens) {
    console.error("Erro ao buscar itens:", erroItens);
  }

  const taxaCartaoNumero = Number(pedido.taxa_cartao ?? 0);
  const descontoFidelidadeNumero = Number(pedido.desconto_fidelidade ?? 0);

  const pontosFidelidadeUsados = Number(pedido.pontos_fidelidade_usados ?? 0);

  return (
    <>
      <PrintableOrderReceipt
        pedido={{
          id: pedido.id,
          created_at: pedido.created_at,
          nome_cliente: pedido.nome_cliente,
          telefone: pedido.telefone,
          cep: pedido.cep,
          rua: pedido.rua,
          numero: pedido.numero,
          complemento: pedido.complemento,
          bairro: pedido.bairro,
          referencia: pedido.referencia,
          forma_pagamento: pedido.forma_pagamento,
          troco_para: pedido.troco_para ? Number(pedido.troco_para) : null,
          subtotal: Number(pedido.subtotal),
          taxa_entrega: Number(pedido.taxa_entrega),
          taxa_cartao: Number(pedido.taxa_cartao ?? 0),
          desconto_fidelidade: descontoFidelidadeNumero,
          pontos_fidelidade_usados: pontosFidelidadeUsados,
          total: Number(pedido.total),
          pagamento_confirmado: Boolean(pedido.pagamento_confirmado),
        }}
        itens={(itens ?? []).map((item) => ({
          id: item.id,
          nome_produto: item.nome_produto,
          preco_unitario: Number(item.preco_unitario),
          quantidade: Number(item.quantidade),
          subtotal: Number(item.subtotal),
        }))}
      />

      <main className="print:hidden min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/admin/pedidos"
            className="group/voltar inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-4 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500 transition duration-300 hover:border-amber-400/25 hover:bg-amber-400/[0.05] hover:text-amber-400"
          >
            <span className="transition duration-300 group-hover/voltar:-translate-x-1">
              ←
            </span>
            Voltar para pedidos
          </Link>

          <div className="group/detalhe relative mt-6 overflow-hidden rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-8">
            {/* GLOWS */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-amber-400/[0.055] blur-[120px]"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-36 -right-28 h-80 w-80 rounded-full bg-orange-500/[0.035] blur-[130px]"
            />

            {/* GRID DECORATIVO */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />

            {/* CABEÇALHO */}
            <div className="relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="h-px w-8 bg-amber-400" />

                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                    Pedido #{pedido.id}
                  </p>

                  <span className="h-1 w-1 rounded-full bg-zinc-700" />

                  <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700">
                    Detalhes da operação
                  </span>
                </div>

                <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">
                  {pedido.nome_cliente}
                </h1>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {/* STATUS */}
                  <span
                    className={`rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] ${
                      pedido.status === "recebido"
                        ? "border-amber-400/15 bg-amber-400/[0.07] text-amber-400"
                        : pedido.status === "em_preparacao"
                          ? "border-orange-400/15 bg-orange-400/[0.07] text-orange-400"
                          : pedido.status === "saiu_entrega"
                            ? "border-blue-400/15 bg-blue-400/[0.07] text-blue-400"
                            : pedido.status === "entregue"
                              ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-400"
                              : pedido.status === "cancelado"
                                ? "border-red-400/15 bg-red-400/[0.07] text-red-400"
                                : "border-white/[0.07] bg-white/[0.03] text-zinc-400"
                    }`}
                  >
                    {formatarStatus(pedido.status)}
                  </span>

                  {/* HORÁRIO */}
                  <span className="flex items-center gap-2 rounded-full border border-white/[0.05] bg-black/20 px-3 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-zinc-600">
                    <span>◷</span>
                    {formatarDataHora(pedido.created_at)}
                  </span>
                </div>

                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">
                  Acompanhe informações do cliente, pagamento, entrega, itens e
                  andamento operacional deste pedido.
                </p>
              </div>

              {/* TOTAL */}
              <div className="relative min-w-[220px] overflow-hidden rounded-[24px] border border-amber-400/15 bg-amber-400/[0.045] p-5 lg:text-right">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-400/[0.09] blur-3xl"
                />

                <div className="relative">
                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-amber-400/70">
                      Total do pedido
                    </p>

                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/[0.07] text-sm">
                      💰
                    </span>
                  </div>

                  <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-white">
                    {formatarPreco(Number(pedido.total))}
                  </p>

                  <div className="mt-4 flex items-center gap-2 border-t border-amber-400/[0.08] pt-3 lg:justify-end">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>

                    <span className="text-[7px] font-black uppercase tracking-[0.12em] text-zinc-600">
                      Pedido carregado
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DIVISOR */}
            <div className="relative mt-7 h-px w-full bg-linear-to-r from-amber-400/20 via-white/[0.05] to-transparent" />

            <div className="relative mt-8 grid gap-4 md:grid-cols-2">
              {/* CONTATO */}
              <div className="group/contato relative overflow-hidden rounded-[24px] border border-emerald-400/10 bg-emerald-400/[0.025] p-5 transition duration-500 hover:-translate-y-0.5 hover:border-emerald-400/25 hover:shadow-[0_20px_60px_rgba(52,211,153,0.06)] sm:p-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/[0.06] blur-3xl transition duration-500 group-hover/contato:bg-emerald-400/[0.1]"
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-emerald-400/15 bg-emerald-400/[0.07] text-lg transition duration-300 group-hover/contato:scale-110">
                      ☎
                    </div>

                    <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.05] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-400">
                      Contato
                    </span>
                  </div>

                  <p className="mt-5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
                    Telefone do cliente
                  </p>

                  <p className="mt-1 text-xl font-black tracking-[-0.025em] text-white">
                    {pedido.telefone}
                  </p>

                  <a
                    href={linkWhatsApp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/whatsapp relative mt-5 flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-[16px] border border-emerald-300/20 bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_12px_35px_rgba(16,185,129,0.12)] transition duration-300 hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-[0_16px_45px_rgba(16,185,129,0.2)] sm:w-fit"
                  >
                    <span className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover/whatsapp:left-[120%]" />

                    <span className="relative text-base">💬</span>

                    <span className="relative">Chamar no WhatsApp</span>

                    <span className="relative transition duration-300 group-hover/whatsapp:translate-x-1">
                      →
                    </span>
                  </a>

                  <div className="mt-4 flex items-center gap-2 border-t border-emerald-400/[0.07] pt-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                    <span className="text-[7px] font-black uppercase tracking-[0.12em] text-zinc-700">
                      Comunicação direta com o cliente
                    </span>
                  </div>
                </div>
              </div>

              {/* PAGAMENTO */}
              <div
                className={`group/pagamento relative overflow-hidden rounded-[24px] border p-5 transition duration-500 hover:-translate-y-0.5 sm:p-6 ${
                  pedido.forma_pagamento === "pix"
                    ? pedido.pagamento_confirmado
                      ? "border-emerald-400/10 bg-emerald-400/[0.025] hover:border-emerald-400/25"
                      : "border-amber-400/15 bg-amber-400/[0.03] hover:border-amber-400/30"
                    : "border-cyan-400/10 bg-cyan-400/[0.025] hover:border-cyan-400/25"
                }`}
              >
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl transition duration-500 ${
                    pedido.forma_pagamento === "pix"
                      ? pedido.pagamento_confirmado
                        ? "bg-emerald-400/[0.06] group-hover/pagamento:bg-emerald-400/[0.1]"
                        : "bg-amber-400/[0.07] group-hover/pagamento:bg-amber-400/[0.11]"
                      : "bg-cyan-400/[0.05] group-hover/pagamento:bg-cyan-400/[0.09]"
                  }`}
                />

                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-[16px] border text-lg transition duration-300 group-hover/pagamento:scale-110 ${
                        pedido.forma_pagamento === "pix"
                          ? pedido.pagamento_confirmado
                            ? "border-emerald-400/15 bg-emerald-400/[0.07]"
                            : "border-amber-400/15 bg-amber-400/[0.07]"
                          : "border-cyan-400/15 bg-cyan-400/[0.06]"
                      }`}
                    >
                      {pedido.forma_pagamento === "pix"
                        ? "◆"
                        : pedido.forma_pagamento === "cartao_entrega"
                          ? "💳"
                          : "💵"}
                    </div>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${
                        pedido.forma_pagamento === "pix"
                          ? pedido.pagamento_confirmado
                            ? "border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-400"
                            : "border-amber-400/10 bg-amber-400/[0.05] text-amber-400"
                          : "border-cyan-400/10 bg-cyan-400/[0.05] text-cyan-400"
                      }`}
                    >
                      {pedido.forma_pagamento === "pix"
                        ? pedido.pagamento_confirmado
                          ? "Confirmado"
                          : "Pendente"
                        : "Na entrega"}
                    </span>
                  </div>

                  <p className="mt-5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
                    Forma de pagamento
                  </p>

                  <p className="mt-1 text-xl font-black tracking-[-0.025em] text-white">
                    {formatarPagamento(pedido.forma_pagamento)}
                  </p>

                  {pedido.forma_pagamento === "cartao_entrega" &&
                    taxaCartaoNumero > 0 && (
                      <div className="mt-4 rounded-[16px] border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3">
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-amber-400">
                          Taxa da maquininha
                        </p>

                        <p className="mt-1 text-sm font-black text-white">
                          {formatarPreco(taxaCartaoNumero)}
                        </p>
                      </div>
                    )}

                  {pedido.forma_pagamento === "pix" && (
                    <div
                      className={`mt-5 flex items-center gap-3 rounded-[16px] border px-4 py-3 ${
                        pedido.pagamento_confirmado
                          ? "border-emerald-400/10 bg-emerald-400/[0.04]"
                          : "border-amber-400/10 bg-amber-400/[0.04]"
                      }`}
                    >
                      <span
                        className={`relative flex h-2 w-2 ${
                          pedido.pagamento_confirmado ? "" : "animate-pulse"
                        }`}
                      >
                        <span
                          className={`relative inline-flex h-2 w-2 rounded-full ${
                            pedido.pagamento_confirmado
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                          }`}
                        />
                      </span>

                      <div>
                        <p
                          className={`text-[8px] font-black uppercase tracking-[0.1em] ${
                            pedido.pagamento_confirmado
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {pedido.pagamento_confirmado
                            ? "PIX confirmado"
                            : "Aguardando confirmação do PIX"}
                        </p>

                        <p className="mt-1 text-[8px] text-zinc-700">
                          {pedido.pagamento_confirmado
                            ? "Pagamento registrado no sistema."
                            : "Confirme o pagamento antes de avançar o pedido."}
                        </p>
                      </div>
                    </div>
                  )}

                  {pedido.forma_pagamento !== "pix" && (
                    <div className="mt-5 flex items-center gap-2 border-t border-white/[0.05] pt-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />

                      <span className="text-[7px] font-black uppercase tracking-[0.12em] text-zinc-700">
                        Pagamento realizado na entrega
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-black">Endereço de entrega</h2>

              <p className="mt-4">
                {pedido.rua}, {pedido.numero}
              </p>

              <p className="text-zinc-400">
                {pedido.bairro} • CEP {pedido.cep}
              </p>

              {pedido.complemento && (
                <p className="mt-2 text-zinc-400">
                  Complemento: {pedido.complemento}
                </p>
              )}

              {pedido.referencia && (
                <p className="mt-2 text-zinc-400">
                  Referência: {pedido.referencia}
                </p>
              )}
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-black">Itens do pedido</h2>

              <div className="mt-4 space-y-3">
                {itens?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 p-4"
                  >
                    <div>
                      <p className="font-bold">
                        {item.quantidade}x {item.nome_produto}
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        {formatarPreco(Number(item.preco_unitario))} cada
                      </p>
                    </div>

                    <p className="font-black">
                      {formatarPreco(Number(item.subtotal))}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-zinc-800 pt-6">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>{formatarPreco(Number(pedido.subtotal))}</span>
              </div>

              <div className="mt-3 flex justify-between text-zinc-400">
                <span>Taxa de entrega</span>
                <span>{formatarPreco(Number(pedido.taxa_entrega))}</span>
              </div>

              {taxaCartaoNumero > 0 && (
                <div className="mt-3 flex justify-between text-zinc-400">
                  <span>Taxa do cartão</span>

                  <span className="font-black text-amber-400">
                    {formatarPreco(taxaCartaoNumero)}
                  </span>
                </div>
              )}
              {descontoFidelidadeNumero > 0 && (
                <div className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-emerald-400">
                        Desconto fidelidade
                      </p>

                      {pontosFidelidadeUsados > 0 && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {pontosFidelidadeUsados} pontos utilizados
                          {pedido.status === "cancelado"
                            ? " • pontos estornados"
                            : ""}
                        </p>
                      )}
                    </div>

                    <span className="font-black text-emerald-400">
                      - {formatarPreco(descontoFidelidadeNumero)}
                    </span>
                  </div>
                </div>
              )}

              {pedido.forma_pagamento === "dinheiro" && pedido.troco_para && (
                <div className="mt-3 flex justify-between text-zinc-400">
                  <span>Troco para</span>
                  <span>{formatarPreco(Number(pedido.troco_para))}</span>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-5">
                <span className="text-xl font-black">Total</span>

                <span className="text-3xl font-black text-amber-400">
                  {formatarPreco(Number(pedido.total))}
                </span>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-800 p-6">
              <h2 className="text-xl font-black">Histórico do pedido</h2>

              {!historicoStatus || historicoStatus.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">
                  Nenhuma alteração de status registrada ainda.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {historicoStatus.map((registro) => (
                    <div
                      key={registro.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <p className="font-bold">
                        {registro.status_anterior
                          ? `${formatarStatus(registro.status_anterior)} → ${formatarStatus(
                              registro.status_novo,
                            )}`
                          : formatarStatus(registro.status_novo)}
                      </p>

                      <p className="mt-1 text-sm text-zinc-500">
                        {formatarDataHora(registro.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="text-xl font-black">Gerenciar pedido</h2>

              <div className="mt-5">
                <PrintOrderButton />
              </div>

              {pedido.forma_pagamento === "pix" &&
                pedido.status !== "cancelado" && (
                  <div className="mt-5 rounded-xl border border-zinc-800 p-4">
                    <p className="text-sm font-bold text-zinc-400">
                      Pagamento PIX
                    </p>

                    <ConfirmPaymentButton
                      pedidoId={pedido.id}
                      pagamentoConfirmado={pedido.pagamento_confirmado}
                      statusAtual={pedido.status}
                    />
                  </div>
                )}

              <OrderStatusButtons
                pedidoId={pedido.id}
                statusAtual={pedido.status}
                telefone={pedido.telefone}
                formaPagamento={pedido.forma_pagamento}
                pagamentoConfirmado={pedido.pagamento_confirmado}
                codigoAcesso={pedido.codigo_acesso}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

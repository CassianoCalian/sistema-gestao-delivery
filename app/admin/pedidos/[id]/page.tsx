import { notFound } from "next/navigation";
import Link from "next/link";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import OrderStatusButtons from "../../../../components/OrderStatusButtons";
import ConfirmPaymentButton from "../../../../components/ConfirmPaymentButton";

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

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/admin/pedidos"
          className="text-sm font-bold text-amber-400"
        >
          ← Voltar para pedidos
        </Link>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-amber-400">
                Pedido #{pedido.id}
              </p>

              <h1 className="mt-2 text-4xl font-black">
                {pedido.nome_cliente}
              </h1>

              <p className="mt-2 text-zinc-400">
                {formatarStatus(pedido.status)}
              </p>
            </div>

            <div className="md:text-right">
              <p className="text-sm text-zinc-500">Total do pedido</p>

              <p className="text-3xl font-black text-amber-400">
                {formatarPreco(Number(pedido.total))}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="text-sm text-zinc-500">Telefone</p>

              <p className="mt-1 font-bold">{pedido.telefone}</p>

              <a
                href={linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-green-500 px-4 py-2 text-sm font-black text-white transition hover:bg-green-400"
              >
                💬 Chamar no WhatsApp
              </a>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="text-sm text-zinc-500">Pagamento</p>

              <p className="mt-1 font-bold">
                {formatarPagamento(pedido.forma_pagamento)}
              </p>
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
  );
}

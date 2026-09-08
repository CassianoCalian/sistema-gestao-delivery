import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import CopyPixButton from "../../../components/copyPixButton";
import PedidoAutoRefresh from "../../../components/PedidoAutoRefresh";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
  },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PedidoPageProps = {
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

function obterEtapaStatus(status: string) {
  if (status === "recebido") {
    return 1;
  }

  if (status === "em_preparacao") {
    return 2;
  }

  if (status === "saiu_entrega") {
    return 3;
  }

  if (status === "entregue") {
    return 4;
  }

  return 0;
}

function obterCabecalhoStatus(status: string) {
  if (status === "recebido") {
    return {
      icone: "✅",
      titulo: "Pedido recebido",
      mensagem: "Recebemos seu pedido com sucesso.",
      cor: "text-amber-400",
    };
  }

  if (status === "em_preparacao") {
    return {
      icone: "🍺",
      titulo: "Pedido em preparação",
      mensagem: "Estamos separando seu pedido.",
      cor: "text-orange-400",
    };
  }

  if (status === "saiu_entrega") {
    return {
      icone: "🚚",
      titulo: "Pedido a caminho",
      mensagem: "Seu pedido saiu para entrega.",
      cor: "text-blue-400",
    };
  }

  if (status === "entregue") {
    return {
      icone: "✅",
      titulo: "Pedido entregue",
      mensagem: "Seu pedido foi entregue. Obrigado pela preferência!",
      cor: "text-green-400",
    };
  }

  if (status === "cancelado") {
    return {
      icone: "❌",
      titulo: "Pedido cancelado",
      mensagem:
        "Este pedido foi cancelado. Entre em contato conosco se precisar de ajuda.",
      cor: "text-red-400",
    };
  }

  return {
    icone: "📦",
    titulo: "Pedido",
    mensagem: "Acompanhe as informações do seu pedido.",
    cor: "text-zinc-400",
  };
}

export default async function PedidoPage({ params }: PedidoPageProps) {
  const { id } = await params;
  const pixKey = process.env.PIX_KEY;

  const codigoAcesso = id;

  if (!codigoAcesso) {
    notFound();
  }

  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from("pedidos")
    .select(
      `
        id,
        created_at,
        nome_cliente,
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
    .eq("codigo_acesso", codigoAcesso)
    .single();

  if (erroPedido || !pedido) {
    notFound();
  }

  const etapaAtual = obterEtapaStatus(pedido.status);
  const cabecalhoStatus = obterCabecalhoStatus(pedido.status);

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
    .eq("pedido_id", pedido.id);

  if (erroItens) {
    console.error("Erro ao buscar itens do pedido:", erroItens);
  }

  const { data: historicoStatus, error: erroHistorico } = await supabaseAdmin
    .from("historico_status_pedidos")
    .select(
      `
      id,
      status_novo,
      created_at
    `,
    )
    .eq("pedido_id", pedido.id)
    .order("created_at", { ascending: false });

  if (erroHistorico) {
    console.error("Erro ao buscar histórico do pedido:", erroHistorico);
  }

  function obterHorarioStatus(status: string) {
    const registro = historicoStatus?.find(
      (item) => item.status_novo === status,
    );

    return registro ? formatarDataHora(registro.created_at) : null;
  }

  const horarioRecebido = formatarDataHora(pedido.created_at);
  const horarioPreparacao = obterHorarioStatus("em_preparacao");
  const horarioSaiuEntrega = obterHorarioStatus("saiu_entrega");
  const horarioEntregue = obterHorarioStatus("entregue");
  const itensMensagem =
    itens
      ?.map(
        (item) =>
          `${item.quantidade}x ${item.nome_produto} - ${formatarPreco(
            Number(item.subtotal),
          )}`,
      )
      .join("\n") ?? "";

  const mensagemWhatsApp = [
    `Olá! Acabei de fazer um pedido pelo site do Depósito do Zé. 🍺`,
    ``,
    `📦 Pedido #${pedido.id}`,
    `👤 Cliente: ${pedido.nome_cliente}`,
    ``,
    `🛒 Itens:`,
    itensMensagem,
    ``,
    `💳 Pagamento: ${formatarPagamento(pedido.forma_pagamento)}`,
    pedido.forma_pagamento === "dinheiro" && pedido.troco_para
      ? `💵 Troco para: ${formatarPreco(Number(pedido.troco_para))}`
      : "",
    `💰 Total: ${formatarPreco(Number(pedido.total))}`,
    ``,
    `📍 Entrega:`,
    `${pedido.rua}, ${pedido.numero}`,
    `${pedido.bairro} - CEP ${pedido.cep}`,
    pedido.complemento ? `Complemento: ${pedido.complemento}` : "",
    pedido.referencia ? `Referência: ${pedido.referencia}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const linkWhatsApp = `https://web.whatsapp.com/send?phone=${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}&text=${encodeURIComponent(
    mensagemWhatsApp,
  )}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <PedidoAutoRefresh statusAtual={pedido.status} />
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-8">
          <div className="text-center">
            <div className="text-6xl">{cabecalhoStatus.icone}</div>

            <p
              className={`mt-5 text-sm font-black uppercase tracking-widest ${cabecalhoStatus.cor}`}
            >
              {cabecalhoStatus.titulo}
            </p>

            <h1 className="mt-2 text-4xl font-black">Pedido #{pedido.id}</h1>

            <p className="mt-3 text-zinc-400">{cabecalhoStatus.mensagem}</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="text-sm text-zinc-500">Cliente</p>

              <p className="mt-1 font-bold">{pedido.nome_cliente}</p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="text-sm text-zinc-500">Pagamento</p>

              <p className="mt-1 font-bold">
                {formatarPagamento(pedido.forma_pagamento)}
              </p>
              {pedido.forma_pagamento === "dinheiro" && pedido.troco_para && (
                <p className="mt-2 text-sm text-zinc-400">
                  Troco para: {formatarPreco(Number(pedido.troco_para))}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="text-sm text-zinc-500">Status</p>

              <p className={`mt-1 font-bold ${cabecalhoStatus.cor}`}>
                {formatarStatus(pedido.status)}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-950 p-5">
              <p className="text-sm text-zinc-500">Total</p>

              <p className="mt-1 text-2xl font-black text-amber-400">
                {formatarPreco(Number(pedido.total))}
              </p>
            </div>
          </div>

          {pedido.status !== "cancelado" && (
            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-green-500 px-6 py-4 text-center text-lg font-black text-white transition hover:bg-green-400"
            >
              💬 Enviar pedido pelo WhatsApp
            </a>
          )}

          {pedido.status === "cancelado" ? (
            <div className="mt-8 rounded-2xl border border-red-900 bg-red-950/20 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-2xl">
                  ❌
                </div>

                <div>
                  <h2 className="text-xl font-black text-red-400">
                    Pedido cancelado
                  </h2>

                  <p className="mt-2 text-zinc-300">
                    Este pedido foi cancelado e não seguirá para preparação ou
                    entrega.
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Se você tiver alguma dúvida, entre em contato com o Depósito
                    do Zé.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <h2 className="text-xl font-black">Acompanhe seu pedido</h2>

              <div className="mt-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-black ${
                      etapaAtual >= 1
                        ? "bg-amber-400 text-zinc-950"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {etapaAtual >= 1 ? "✓" : "1"}
                  </div>

                  <div>
                    <p className="font-bold">Pedido recebido</p>

                    <p className="text-sm text-zinc-500">
                      Recebemos seu pedido.
                    </p>

                    <p className="mt-1 text-xs font-bold text-amber-400">
                      {horarioRecebido}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-black ${
                      etapaAtual >= 2
                        ? "bg-amber-400 text-zinc-950"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {etapaAtual >= 2 ? "✓" : "2"}
                  </div>

                  <div>
                    <p className="font-bold">Em preparação</p>

                    <p className="text-sm text-zinc-500">
                      Seu pedido está sendo separado.
                    </p>

                    {horarioPreparacao && (
                      <p className="mt-1 text-xs font-bold text-amber-400">
                        {horarioPreparacao}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-black ${
                      etapaAtual >= 3
                        ? "bg-amber-400 text-zinc-950"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {etapaAtual >= 3 ? "✓" : "3"}
                  </div>

                  <div>
                    <p className="font-bold">Saiu para entrega</p>

                    <p className="text-sm text-zinc-500">
                      Seu pedido está a caminho.
                    </p>

                    {horarioSaiuEntrega && (
                      <p className="mt-1 text-xs font-bold text-amber-400">
                        {horarioSaiuEntrega}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full font-black ${
                      etapaAtual >= 4
                        ? "bg-green-500 text-white"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {etapaAtual >= 4 ? "✓" : "4"}
                  </div>

                  <div>
                    <p className="font-bold">Entregue</p>

                    <p className="text-sm text-zinc-500">Pedido finalizado.</p>

                    {horarioEntregue && (
                      <p className="mt-1 text-xs font-bold text-green-400">
                        {horarioEntregue}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

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

          <div className="mt-8 rounded-2xl border border-zinc-800 p-5">
            <h2 className="font-black">Endereço de entrega</h2>

            <p className="mt-3 text-zinc-300">
              {pedido.rua}, {pedido.numero}
            </p>

            <p className="text-zinc-400">
              {pedido.bairro} • CEP {pedido.cep}
            </p>

            {pedido.complemento && (
              <p className="mt-1 text-zinc-400">
                Complemento: {pedido.complemento}
              </p>
            )}

            {pedido.referencia && (
              <p className="mt-1 text-zinc-400">
                Referência: {pedido.referencia}
              </p>
            )}
          </div>

          {pedido.forma_pagamento === "pix" &&
            pedido.status !== "cancelado" && (
              <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
                <p className="text-sm font-black uppercase tracking-widest text-amber-400">
                  Pagamento via PIX
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Finalize seu pagamento
                </h2>

                <p className="mt-3 text-zinc-400">
                  Copie a chave PIX abaixo e realize o pagamento no aplicativo
                  do seu banco.
                </p>

                {pixKey ? (
                  <>
                    <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                      <p className="text-sm text-zinc-500">Chave PIX</p>

                      <p className="mt-1 break-all font-bold text-white">
                        {pixKey}
                      </p>
                    </div>

                    <div className="mt-4">
                      <CopyPixButton pixKey={pixKey} />
                    </div>

                    <p className="mt-4 text-sm text-zinc-500">
                      Após realizar o pagamento, guarde o comprovante.
                    </p>
                    {pedido.pagamento_confirmado ? (
                      <div className="mt-5 rounded-xl border border-green-800 bg-green-950/30 p-4">
                        <p className="font-black text-green-400">
                          ✅ Pagamento confirmado
                        </p>

                        <p className="mt-1 text-sm text-green-300">
                          Recebemos a confirmação do seu pagamento via PIX.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-5 rounded-xl border border-amber-800 bg-amber-950/20 p-4">
                        <p className="font-bold text-amber-400">
                          ⏳ Aguardando confirmação do pagamento
                        </p>

                        <p className="mt-1 text-sm text-zinc-400">
                          Assim que o pagamento for confirmado, esta página será
                          atualizada automaticamente.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-5 font-bold text-red-400">
                    Chave PIX não configurada.
                  </p>
                )}
              </div>
            )}

          <div className="mt-8 border-t border-zinc-800 pt-6">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>

              <span>{formatarPreco(Number(pedido.subtotal))}</span>
            </div>

            <div className="mt-3 flex justify-between text-zinc-400">
              <span>Taxa de entrega</span>

              <span>{formatarPreco(Number(pedido.taxa_entrega))}</span>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-5">
              <span className="text-lg font-black">Total</span>

              <span className="text-3xl font-black text-amber-400">
                {formatarPreco(Number(pedido.total))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

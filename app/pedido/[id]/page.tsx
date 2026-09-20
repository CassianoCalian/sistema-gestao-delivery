import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
taxa_cartao,
desconto_fidelidade,
pontos_fidelidade_usados,
codigo_cupom,
desconto_cupom,
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
subtotal,
opcoes_selecionadas
      `,
    )
    .eq("pedido_id", pedido.id);

  if (erroItens) {
    if (process.env.NODE_ENV === "development") {
      console.error("Erro ao buscar itens do pedido:", erroItens);
    } else {
      console.error("Erro ao buscar itens do pedido.");
    }
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
    if (process.env.NODE_ENV === "development") {
      console.error("Erro ao buscar histórico do pedido:", erroHistorico);
    } else {
      console.error("Erro ao buscar histórico do pedido.");
    }
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
  const taxaEntregaNumero = Number(pedido.taxa_entrega ?? 0);
  const taxaCartaoNumero = Number(pedido.taxa_cartao ?? 0);

  const descontoFidelidadeNumero = Number(pedido.desconto_fidelidade ?? 0);
  const descontoCupomNumero = Number(pedido.desconto_cupom ?? 0);

  const codigoCupom =
    typeof pedido.codigo_cupom === "string" ? pedido.codigo_cupom : "";

  const pontosFidelidadeUsados = Number(pedido.pontos_fidelidade_usados ?? 0);
  const itensMensagem =
    itens
      ?.map((item) => {
        const linhaProduto = `${item.quantidade}x ${item.nome_produto} - ${formatarPreco(
          Number(item.subtotal),
        )}`;

        if (
          !Array.isArray(item.opcoes_selecionadas) ||
          item.opcoes_selecionadas.length === 0
        ) {
          return linhaProduto;
        }

        const linhasOpcoes = item.opcoes_selecionadas
          .map((opcao) => {
            if (
              typeof opcao !== "object" ||
              opcao === null ||
              Array.isArray(opcao)
            ) {
              return null;
            }

            const nome = typeof opcao.nome === "string" ? opcao.nome : "Opção";

            const quantidade =
              typeof opcao.quantidade === "number"
                ? opcao.quantidade
                : Number(opcao.quantidade ?? 0);

            return `   • ${nome}: ${quantidade}`;
          })
          .filter(Boolean)
          .join("\n");

        return `${linhaProduto}\n${linhasOpcoes}`;
      })
      .join("\n") ?? "";

  const mensagemWhatsApp = [
    `Olá! Acabei de fazer um pedido pelo site do Depósito do Zé. 🍺`,
    ``,
    `👤 Cliente: ${pedido.nome_cliente}`,
    ``,
    `🛒 Itens:`,
    itensMensagem,
    ``,
    `💳 Pagamento: ${formatarPagamento(pedido.forma_pagamento)}`,

    taxaCartaoNumero > 0
      ? `💳 Taxa do cartão: ${formatarPreco(taxaCartaoNumero)}`
      : "",

    pedido.forma_pagamento === "dinheiro" && pedido.troco_para
      ? `💵 Troco para: ${formatarPreco(Number(pedido.troco_para))}`
      : "",

    descontoFidelidadeNumero > 0
      ? `⭐ Fidelidade: -${formatarPreco(
          descontoFidelidadeNumero,
        )} (${pontosFidelidadeUsados} pontos)`
      : "",
    descontoCupomNumero > 0 && codigoCupom
      ? `🎟️ Cupom ${codigoCupom}: -${formatarPreco(descontoCupomNumero)}`
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

  const etapas = [
    {
      numero: 1,
      titulo: "Pedido recebido",
      descricao: "Recebemos seu pedido.",
      horario: horarioRecebido,
      icone: "✓",
    },
    {
      numero: 2,
      titulo: "Em preparação",
      descricao: "Estamos separando tudo para você.",
      horario: horarioPreparacao,
      icone: "🍺",
    },
    {
      numero: 3,
      titulo: "Saiu para entrega",
      descricao: "Seu pedido está a caminho.",
      horario: horarioSaiuEntrega,
      icone: "🚚",
    },
    {
      numero: 4,
      titulo: "Entregue",
      descricao: "Pedido finalizado. Aproveite!",
      horario: horarioEntregue,
      icone: "✓",
    },
  ];

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#070707] text-white"
      style={{
        backgroundImage: `
      radial-gradient(circle at 50% 6%, rgba(245,158,11,0.11), transparent 25%),
      radial-gradient(circle at 6% 42%, rgba(249,115,22,0.055), transparent 25%),
      radial-gradient(circle at 94% 72%, rgba(245,158,11,0.05), transparent 28%),
      linear-gradient(180deg, #080808 0%, #0b0907 48%, #070707 100%)
    `,
      }}
    >
      <PedidoAutoRefresh statusAtual={pedido.status} />

      {/* GLOWS DE FUNDO */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-48 -top-48 h-[420px] w-[420px] rounded-full bg-amber-400/[0.055] blur-[140px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-56 -right-52 h-[520px] w-[520px] rounded-full bg-orange-600/[0.045] blur-[160px]"
      />

      {/* HEADER */}
      <header className="relative z-30 border-b border-white/[0.06] bg-zinc-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="pressable relative h-12 w-[98px] sm:h-14 sm:w-[118px]"
            aria-label="Voltar para a loja"
          >
            <Image
              src="/logo-deposito-ze.png"
              alt="Depósito do Zé"
              fill
              priority
              sizes="118px"
              className="object-contain"
            />
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>

            <span className="text-[9px] font-black uppercase tracking-[0.11em] text-emerald-400 sm:text-[10px]">
              Atualização automática
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        {/* STATUS PRINCIPAL */}
        <section
          className={`animate-scale-in relative overflow-hidden rounded-[32px] border p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.35)] sm:p-9 ${
            pedido.status === "cancelado"
              ? "border-red-500/20 bg-red-500/[0.045]"
              : pedido.status === "entregue"
                ? "border-emerald-400/20 bg-emerald-400/[0.04]"
                : "border-amber-400/15 bg-white/[0.025]"
          }`}
        >
          {/* LUZ */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] ${
              pedido.status === "cancelado"
                ? "bg-red-500/15"
                : pedido.status === "entregue"
                  ? "bg-emerald-400/12"
                  : "bg-amber-400/12"
            }`}
          />

          {/* ÍCONE */}
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            {pedido.status !== "cancelado" && pedido.status !== "entregue" && (
              <span className="absolute inset-2 animate-ping rounded-full border border-amber-400/15 opacity-40" />
            )}

            <div
              className={`relative flex h-20 w-20 items-center justify-center rounded-[28px] border text-4xl shadow-xl ${
                pedido.status === "cancelado"
                  ? "border-red-400/20 bg-red-400/10"
                  : pedido.status === "entregue"
                    ? "border-emerald-400/20 bg-emerald-400/10"
                    : "border-amber-400/20 bg-amber-400/[0.08]"
              }`}
            >
              {cabecalhoStatus.icone}
            </div>
          </div>

          <p
            className={`mt-5 text-[10px] font-black uppercase tracking-[0.18em] ${cabecalhoStatus.cor}`}
          >
            {cabecalhoStatus.titulo}
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
            Seu pedido
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-400">
            {cabecalhoStatus.mensagem}
          </p>

          {/* STATUS TAG */}
          <div className="mt-5 flex justify-center">
            <span className="rounded-full border border-white/[0.07] bg-black/20 px-4 py-2 text-[10px] font-black text-zinc-300 backdrop-blur">
              {formatarStatus(pedido.status)}
            </span>
          </div>
        </section>

        {/* RESUMO RÁPIDO */}
        <section className="animate-slide-up delay-1 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="premium-card rounded-[22px] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
              Cliente
            </p>

            <p className="mt-2 truncate text-xs font-black text-white sm:text-sm">
              {pedido.nome_cliente}
            </p>
          </div>

          <div className="premium-card rounded-[22px] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
              Pagamento
            </p>

            <p className="mt-2 text-xs font-black text-white sm:text-sm">
              {formatarPagamento(pedido.forma_pagamento)}
            </p>
          </div>

          <div className="premium-card rounded-[22px] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
              Entrega
            </p>

            <p
              className={`mt-2 text-xs font-black sm:text-sm ${
                pedido.status === "entregue"
                  ? "text-emerald-400"
                  : "text-zinc-300"
              }`}
            >
              {pedido.status === "entregue"
                ? "Concluída"
                : pedido.status === "cancelado"
                  ? "Cancelada"
                  : "Em andamento"}
            </p>
          </div>

          <div className="premium-card rounded-[22px] p-4">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
              Total
            </p>

            <p className="mt-2 text-base font-black tracking-[-0.03em] text-amber-400 sm:text-lg">
              {formatarPreco(Number(pedido.total))}
            </p>
          </div>
        </section>

        {/* TROCO */}
        {pedido.forma_pagamento === "dinheiro" && pedido.troco_para && (
          <div className="animate-slide-up delay-1 mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-center">
            <p className="text-xs text-zinc-500">
              Troco solicitado para{" "}
              <span className="font-black text-white">
                {formatarPreco(Number(pedido.troco_para))}
              </span>
            </p>
          </div>
        )}

        {/* WHATSAPP */}
        {pedido.status !== "cancelado" && (
          <a
            href={linkWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable group mt-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-sm font-black text-white shadow-[0_14px_40px_rgba(34,197,94,0.18)] transition hover:bg-emerald-400"
          >
            <span className="text-lg">💬</span>
            Enviar pedido pelo WhatsApp
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
        )}

        {/* CANCELADO */}
        {pedido.status === "cancelado" ? (
          <section className="animate-slide-up mt-5 overflow-hidden rounded-[28px] border border-red-500/20 bg-red-500/[0.05] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-xl">
                ❌
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-red-400">
                  Pedido encerrado
                </p>

                <h2 className="mt-1 text-xl font-black text-white">
                  Este pedido foi cancelado
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  O pedido não seguirá para preparação ou entrega. Caso precise
                  de ajuda, entre em contato com o Depósito do Zé.
                </p>
                {pontosFidelidadeUsados > 0 && (
                  <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                    <p className="text-xs font-black text-emerald-400">
                      ✓ Seus {pontosFidelidadeUsados} pontos foram devolvidos
                    </p>

                    <p className="mt-1 text-[10px] leading-5 text-zinc-500">
                      Como o pedido foi cancelado, os pontos usados no desconto
                      retornaram para o seu saldo de fidelidade.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          /* TIMELINE */
          <section className="premium-card animate-slide-up delay-2 mt-5 rounded-[28px] p-5 sm:p-7">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-400">
                  Rastreamento
                </p>

                <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                  Acompanhe seu pedido
                </h2>
              </div>

              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[9px] font-black text-zinc-500">
                Etapa {etapaAtual}/4
              </span>
            </div>

            <div className="mt-7">
              {etapas.map((etapa, index) => {
                const concluida = etapaAtual >= etapa.numero;
                const atual = etapaAtual === etapa.numero;
                const ultima = index === etapas.length - 1;

                return (
                  <div key={etapa.numero} className="relative flex gap-4">
                    {/* LINHA */}
                    {!ultima && (
                      <div
                        className={`absolute left-[19px] top-10 h-[calc(100%-4px)] w-px ${
                          etapaAtual > etapa.numero
                            ? "bg-amber-400/40"
                            : "bg-white/[0.07]"
                        }`}
                      />
                    )}

                    {/* ÍCONE */}
                    <div className="relative z-10 flex shrink-0 flex-col items-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-black transition ${
                          etapa.numero === 4 && concluida
                            ? "border-emerald-400 bg-emerald-400 text-zinc-950"
                            : concluida
                              ? "border-amber-400 bg-amber-400 text-zinc-950 shadow-[0_0_25px_rgba(251,191,36,0.16)]"
                              : "border-white/[0.08] bg-zinc-900 text-zinc-600"
                        }`}
                      >
                        {concluida ? etapa.icone : etapa.numero}
                      </div>

                      {atual && etapaAtual < 4 && (
                        <span className="absolute inset-0 animate-ping rounded-full border border-amber-400/20 opacity-40" />
                      )}
                    </div>

                    {/* TEXTO */}
                    <div
                      className={`min-w-0 flex-1 ${ultima ? "pb-0" : "pb-7"}`}
                    >
                      <div
                        className={`rounded-2xl border p-4 ${
                          atual
                            ? "border-amber-400/15 bg-amber-400/[0.045]"
                            : "border-transparent bg-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className={`text-sm font-black ${
                                concluida ? "text-white" : "text-zinc-600"
                              }`}
                            >
                              {etapa.titulo}
                            </p>

                            <p className="mt-1 text-xs leading-5 text-zinc-500">
                              {etapa.descricao}
                            </p>
                          </div>

                          {atual && etapaAtual < 4 && (
                            <span className="shrink-0 rounded-full bg-amber-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-amber-400">
                              Agora
                            </span>
                          )}
                        </div>

                        {etapa.horario && (
                          <p
                            className={`mt-2 text-[10px] font-black ${
                              etapa.numero === 4
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {etapa.horario}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* PIX */}
        {pedido.forma_pagamento === "pix" && pedido.status !== "cancelado" && (
          <section className="animate-slide-up delay-3 relative mt-5 overflow-hidden rounded-[28px] border border-amber-400/20 bg-amber-400/[0.045] p-5 sm:p-7">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl"
            />

            <div className="relative">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-zinc-950">
                  ◆
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-400">
                    Pagamento via PIX
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">
                    Finalize seu pagamento
                  </h2>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Copie a chave abaixo e realize o pagamento pelo aplicativo do
                seu banco.
              </p>

              {pixKey ? (
                <>
                  <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/25 p-4">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                      Chave PIX
                    </p>

                    <p className="mt-2 break-all text-sm font-black text-white">
                      {pixKey}
                    </p>
                  </div>

                  <div className="mt-3">
                    <CopyPixButton pixKey={pixKey} />
                  </div>

                  {pedido.pagamento_confirmado ? (
                    <div className="animate-scale-in mt-5 flex gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-zinc-950">
                        ✓
                      </div>

                      <div>
                        <p className="text-xs font-black text-emerald-400">
                          Pagamento confirmado
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-zinc-500">
                          Recebemos a confirmação do seu PIX.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex gap-3 rounded-2xl border border-amber-400/15 bg-black/15 p-4">
                      <span className="relative mt-1 flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                      </span>

                      <div>
                        <p className="text-xs font-black text-amber-400">
                          Aguardando confirmação
                        </p>

                        <p className="mt-1 text-[10px] leading-5 text-zinc-500">
                          Assim que o pagamento for confirmado, esta página será
                          atualizada automaticamente.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-5 font-black text-red-400">
                  Chave PIX não configurada.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ITENS */}
        <section className="premium-card animate-slide-up delay-3 mt-5 rounded-[28px] p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-400">
                Seu pedido
              </p>

              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">
                Itens
              </h2>
            </div>

            <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[9px] font-black text-zinc-500">
              {itens?.reduce(
                (total, item) => total + Number(item.quantidade),
                0,
              ) ?? 0}{" "}
              itens
            </span>
          </div>

          <div className="mt-5 space-y-2.5">
            {itens?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-amber-400/10 px-1 text-[10px] font-black text-amber-400">
                      {item.quantidade}x
                    </span>

                    <p className="line-clamp-2 text-sm font-black text-white">
                      {item.nome_produto}
                    </p>
                  </div>

                  <p className="mt-2 text-[10px] text-zinc-600">
                    {formatarPreco(Number(item.preco_unitario))} cada
                  </p>
                  {Array.isArray(item.opcoes_selecionadas) &&
                    item.opcoes_selecionadas.length > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.08em] text-amber-400">
                          Sabores / opções
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.opcoes_selecionadas.map((opcao, index) => {
                            if (
                              typeof opcao !== "object" ||
                              opcao === null ||
                              Array.isArray(opcao)
                            ) {
                              return null;
                            }

                            const nome =
                              typeof opcao.nome === "string"
                                ? opcao.nome
                                : "Opção";

                            const quantidade =
                              typeof opcao.quantidade === "number"
                                ? opcao.quantidade
                                : Number(opcao.quantidade ?? 0);

                            return (
                              <span
                                key={`${nome}-${index}`}
                                className="rounded-lg border border-white/[0.06] bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-black text-zinc-300"
                              >
                                {nome} — {quantidade}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>

                <p className="shrink-0 text-sm font-black text-zinc-300">
                  {formatarPreco(Number(item.subtotal))}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ENDEREÇO */}
        <section className="premium-card animate-slide-up delay-4 mt-5 rounded-[28px] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/[0.08] text-lg">
              📍
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-400">
                Destino
              </p>

              <h2 className="mt-1 text-lg font-black text-white">
                Endereço de entrega
              </h2>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.05] bg-black/20 p-4">
            <p className="font-black text-white">
              {pedido.rua}, {pedido.numero}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {pedido.bairro} • CEP {pedido.cep}
            </p>

            {pedido.complemento && (
              <p className="mt-2 text-xs text-zinc-500">
                <span className="font-bold text-zinc-400">Complemento:</span>{" "}
                {pedido.complemento}
              </p>
            )}

            {pedido.referencia && (
              <p className="mt-1 text-xs text-zinc-500">
                <span className="font-bold text-zinc-400">Referência:</span>{" "}
                {pedido.referencia}
              </p>
            )}
          </div>
        </section>

        {/* VALORES */}
        <section className="premium-card animate-slide-up delay-4 mt-5 rounded-[28px] p-5 sm:p-7">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-400">
            Valores
          </p>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Subtotal</span>

              <span className="font-bold text-zinc-300">
                {formatarPreco(Number(pedido.subtotal))}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Taxa de entrega</span>

              <span
                className={`font-black ${
                  taxaEntregaNumero === 0 ? "text-emerald-400" : "text-zinc-300"
                }`}
              >
                {taxaEntregaNumero === 0
                  ? "Grátis"
                  : formatarPreco(taxaEntregaNumero)}
              </span>
            </div>

            {taxaCartaoNumero > 0 && (
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Taxa do cartão</span>

                <span className="font-black text-amber-400">
                  {formatarPreco(taxaCartaoNumero)}
                </span>
              </div>
            )}

            {descontoFidelidadeNumero > 0 && (
              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.045] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-emerald-400">
                      Desconto fidelidade
                    </p>

                    {pontosFidelidadeUsados > 0 && (
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {pontosFidelidadeUsados} pontos utilizados
                        {pedido.status === "cancelado"
                          ? " • pontos devolvidos"
                          : ""}
                      </p>
                    )}

                    {descontoCupomNumero > 0 && codigoCupom && (
                      <div className="rounded-2xl border border-fuchsia-400/10 bg-fuchsia-400/[0.045] p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-black text-fuchsia-300">
                              Cupom de desconto
                            </p>

                            <p className="mt-1 break-all font-mono text-[10px] font-black tracking-[0.04em] text-zinc-400">
                              {codigoCupom}
                            </p>

                            {pedido.status === "cancelado" && (
                              <p className="mt-1 text-[10px] text-zinc-600">
                                Cupom registrado no pedido cancelado
                              </p>
                            )}
                          </div>

                          <span className="shrink-0 font-black text-emerald-400">
                            - {formatarPreco(descontoCupomNumero)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="font-black text-emerald-400">
                    - {formatarPreco(descontoFidelidadeNumero)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="section-divider my-5" />

          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                Total do pedido
              </p>

              <p className="mt-1 text-[10px] text-zinc-600">Valor final</p>
            </div>

            <span className="text-3xl font-black tracking-[-0.05em] text-amber-400">
              {formatarPreco(Number(pedido.total))}
            </span>
          </div>
        </section>

        {/* RODAPÉ */}
        <div className="py-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-white/[0.06]" />

            <Image
              src="/logo-deposito-ze.png"
              alt=""
              width={70}
              height={40}
              className="h-auto w-[70px] opacity-45"
            />

            <span className="h-px w-8 bg-white/[0.06]" />
          </div>

          <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-700">
            Obrigado por comprar com o Zé
          </p>
        </div>
      </div>
    </main>
  );
}

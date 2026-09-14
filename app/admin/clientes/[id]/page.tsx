import Link from "next/link";
import { notFound } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import AdminNavigation from "../../../../components/AdminNavigation";

type AdminClienteDetalheProps = {
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

function formatarData(data: string | null) {
  if (!data) {
    return "Nenhuma compra";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(data));
}

function formatarTelefone(telefone: string) {
  const numeros = telefone.replace(/\D/g, "").replace(/^55/, "");

  if (numeros.length === 11) {
    return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
  }

  return telefone;
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

function visualizarMovimentacaoFidelidade(tipo: string) {
  if (tipo === "credito_pedido") {
    return {
      titulo: "Crédito por pedido",
      icone: "↗",
      estilo: "border-emerald-400/15 bg-emerald-400/[0.04]",
      cor: "text-emerald-400",
    };
  }

  if (tipo === "resgate") {
    return {
      titulo: "Resgate de pontos",
      icone: "↓",
      estilo: "border-amber-400/15 bg-amber-400/[0.04]",
      cor: "text-amber-400",
    };
  }

  if (tipo === "ajuste_credito") {
    return {
      titulo: "Ajuste de crédito",
      icone: "+",
      estilo: "border-blue-400/15 bg-blue-400/[0.04]",
      cor: "text-blue-400",
    };
  }

  if (tipo === "ajuste_debito") {
    return {
      titulo: "Ajuste de débito",
      icone: "−",
      estilo: "border-red-400/15 bg-red-400/[0.04]",
      cor: "text-red-400",
    };
  }

  return {
    titulo: "Movimentação",
    icone: "•",
    estilo: "border-white/[0.06] bg-black/20",
    cor: "text-zinc-400",
  };
}

function calcularDiasDesde(data: string | null) {
  if (!data) {
    return null;
  }

  const diferenca = new Date().getTime() - new Date(data).getTime();

  return Math.floor(diferenca / (1000 * 60 * 60 * 24));
}

function classificarCliente(
  quantidadePedidos: number,
  ultimaCompra: string | null,
) {
  if (quantidadePedidos === 0 || !ultimaCompra) {
    return {
      nome: "Sem compras",
      descricao: "Ainda não realizou pedidos válidos",
      estilo: "border-zinc-500/15 bg-zinc-500/[0.06] text-zinc-400",
    };
  }

  const diasSemComprar = calcularDiasDesde(ultimaCompra);

  if (diasSemComprar !== null && diasSemComprar > 60) {
    return {
      nome: "Inativo",
      descricao: `${diasSemComprar} dias sem comprar`,
      estilo: "border-red-400/15 bg-red-400/[0.06] text-red-400",
    };
  }

  if (quantidadePedidos >= 10) {
    return {
      nome: "VIP",
      descricao: "Cliente de alta frequência",
      estilo: "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    };
  }

  if (quantidadePedidos >= 5) {
    return {
      nome: "Frequente",
      descricao: "Compra com frequência",
      estilo: "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-400",
    };
  }

  if (quantidadePedidos >= 2) {
    return {
      nome: "Recorrente",
      descricao: "Já voltou a comprar",
      estilo: "border-blue-400/15 bg-blue-400/[0.07] text-blue-400",
    };
  }

  return {
    nome: "Novo",
    descricao: "Realizou a primeira compra",
    estilo: "border-amber-400/15 bg-amber-400/[0.07] text-amber-400",
  };
}

export default async function AdminClienteDetalhe({
  params,
}: AdminClienteDetalheProps) {
  const { id } = await params;

  const clienteId = Number(id);

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    notFound();
  }

  const { data: cliente, error: erroCliente } = await supabaseAdmin
    .from("clientes")
    .select(
      `
    id,
    created_at,
    nome,
    telefone,
    telefone_normalizado,
    pontos_saldo,
    fidelidade_progresso_centavos
  `,
    )
    .eq("id", clienteId)
    .single();

  if (erroCliente || !cliente) {
    notFound();
  }

  const { data: pedidosData, error: erroPedidos } = await supabaseAdmin
    .from("pedidos")
    .select(
      `
          id,
          created_at,
          nome_cliente,
          telefone,
          forma_pagamento,
          pagamento_confirmado,
          subtotal,
          taxa_entrega,
          taxa_cartao,
          total,
          status,
          bairro,
          rua,
          numero
        `,
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (erroPedidos) {
    if (process.env.NODE_ENV === "development") {
      console.error("Erro ao buscar pedidos do cliente:", erroPedidos);
    } else {
      console.error("Erro ao buscar pedidos do cliente.");
    }
  }

  const pedidos = pedidosData ?? [];

  // Cancelados aparecem no histórico,
  // mas não contam nas métricas do CRM.
  const pedidosValidos = pedidos.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const quantidadePedidos = pedidosValidos.length;

  const totalGasto = pedidosValidos.reduce(
    (total, pedido) => total + Number(pedido.total),
    0,
  );

  const ticketMedio =
    quantidadePedidos > 0 ? totalGasto / quantidadePedidos : 0;

  const ultimaCompra = pedidosValidos[0]?.created_at ?? null;

  const pedidosValidosOrdenados = [...pedidosValidos].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const primeiraCompra = pedidosValidosOrdenados[0]?.created_at ?? null;

  const segmento = classificarCliente(quantidadePedidos, ultimaCompra);

  // =========================================================
  // FIDELIDADE
  // =========================================================

  const pontosSaldo = Number(cliente.pontos_saldo ?? 0);

  const progressoCentavos = Number(cliente.fidelidade_progresso_centavos ?? 0);

  const valorFaltanteProximoPonto = (500 - progressoCentavos) / 100;

  const percentualProximoPonto = Math.min(100, (progressoCentavos / 500) * 100);

  const descontosDisponiveis = Math.floor(pontosSaldo / 500);

  const valorDescontoDisponivel = descontosDisponiveis * 5;

  const pontosAteProximoDesconto =
    pontosSaldo % 500 === 0 ? 500 : 500 - (pontosSaldo % 500);

  const percentualDesconto = ((pontosSaldo % 500) / 500) * 100;

  // =========================================================
  // EXTRATO DE FIDELIDADE
  // =========================================================

  const {
    data: movimentacoesFidelidadeData,
    error: erroMovimentacoesFidelidade,
  } = await supabaseAdmin
    .from("fidelidade_movimentacoes")
    .select(
      `
        id,
        created_at,
        pedido_id,
        tipo,
        pontos,
        valor_referencia,
        observacao
      `,
    )
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  if (erroMovimentacoesFidelidade) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Erro ao buscar extrato de fidelidade:",
        erroMovimentacoesFidelidade,
      );
    } else {
      console.error("Erro ao buscar extrato de fidelidade.");
    }
  }

  const movimentacoesFidelidade = movimentacoesFidelidadeData ?? [];

  // =========================================================
  // PRODUTOS MAIS COMPRADOS
  // =========================================================

  const idsPedidosValidos = pedidosValidos.map((pedido) => pedido.id);

  let itensPedidos: Array<{
    pedido_id: number;
    nome_produto: string;
    quantidade: number;
    subtotal: number;
  }> = [];

  if (idsPedidosValidos.length > 0) {
    const { data: itensData, error: erroItens } = await supabaseAdmin
      .from("itens_pedido")
      .select(
        `
            pedido_id,
            nome_produto,
            quantidade,
            subtotal
          `,
      )
      .in("pedido_id", idsPedidosValidos);

    if (erroItens) {
      if (process.env.NODE_ENV === "development") {
        console.error("Erro ao buscar produtos do cliente:", erroItens);
      } else {
        console.error("Erro ao buscar produtos do cliente.");
      }
    } else {
      itensPedidos = (itensData ?? []).map((item) => ({
        pedido_id: Number(item.pedido_id),
        nome_produto: item.nome_produto,
        quantidade: Number(item.quantidade),
        subtotal: Number(item.subtotal),
      }));
    }
  }

  const produtosAgrupados = new Map<
    string,
    {
      nome: string;
      quantidade: number;
      totalGasto: number;
    }
  >();

  itensPedidos.forEach((item) => {
    const existente = produtosAgrupados.get(item.nome_produto);

    if (existente) {
      existente.quantidade += item.quantidade;
      existente.totalGasto += item.subtotal;
      return;
    }

    produtosAgrupados.set(item.nome_produto, {
      nome: item.nome_produto,
      quantidade: item.quantidade,
      totalGasto: item.subtotal,
    });
  });

  const produtosMaisComprados = Array.from(produtosAgrupados.values())
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  // =========================================================
  // WHATSAPP
  // =========================================================

  const telefoneLimpo = (
    cliente.telefone_normalizado ?? cliente.telefone.replace(/\D/g, "")
  ).replace(/^55/, "");

  const linkWhatsApp = `https://wa.me/55${telefoneLimpo}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />

        <Link
          href="/admin/clientes"
          className="group inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-4 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500 transition hover:border-violet-400/25 hover:bg-violet-400/[0.05] hover:text-violet-300"
        >
          <span className="transition group-hover:-translate-x-1">←</span>
          Voltar para clientes
        </Link>

        {/* PERFIL */}
        <section className="relative mt-6 overflow-hidden rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-[120px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 -right-28 h-80 w-80 rounded-full bg-blue-500/[0.04] blur-[130px]"
          />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-px w-8 bg-violet-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-300">
                  Cliente #{cliente.id}
                </p>

                <span
                  className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${segmento.estilo}`}
                >
                  {segmento.nome}
                </span>
              </div>

              <h1 className="mt-4 max-w-2xl text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">
                {cliente.nome}
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">
                Perfil consolidado do cliente, histórico de compras, frequência
                e relacionamento com o Depósito do Zé.
              </p>

              <p className="mt-3 text-[10px] font-bold text-zinc-600">
                {segmento.descricao}
              </p>
            </div>

            <div className="min-w-[230px] rounded-[24px] border border-violet-400/15 bg-violet-400/[0.045] p-5">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-violet-300">
                Valor total do cliente
              </p>

              <p className="mt-3 text-3xl font-black tracking-[-0.05em]">
                {formatarPreco(totalGasto)}
              </p>

              <p className="mt-3 border-t border-violet-400/[0.08] pt-3 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                Pedidos não cancelados
              </p>
            </div>
          </div>
        </section>

        {/* MÉTRICAS */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-blue-400/15 bg-blue-400/[0.035] p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-blue-400">
              Pedidos
            </p>

            <p className="mt-2 text-4xl font-black">{quantidadePedidos}</p>

            <p className="mt-2 text-[9px] text-zinc-600">compras válidas</p>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.035] p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-emerald-400">
              Total gasto
            </p>

            <p className="mt-2 text-3xl font-black">
              {formatarPreco(totalGasto)}
            </p>

            <p className="mt-2 text-[9px] text-zinc-600">receita acumulada</p>
          </div>

          <div className="rounded-[24px] border border-amber-400/15 bg-amber-400/[0.035] p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-amber-400">
              Ticket médio
            </p>

            <p className="mt-2 text-3xl font-black">
              {formatarPreco(ticketMedio)}
            </p>

            <p className="mt-2 text-[9px] text-zinc-600">
              valor médio por compra
            </p>
          </div>

          <div className="rounded-[24px] border border-violet-400/15 bg-violet-400/[0.035] p-5">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-violet-300">
              Segmento
            </p>

            <p className="mt-2 text-2xl font-black">{segmento.nome}</p>

            <p className="mt-2 text-[9px] text-zinc-600">
              classificação automática
            </p>
          </div>
        </section>

        {/* FIDELIDADE */}
        <section className="relative mt-6 overflow-hidden rounded-[28px] border border-amber-400/15 bg-amber-400/[0.025] p-6 sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/[0.07] blur-[100px]"
          />

          <div className="relative">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-px w-7 bg-amber-400" />

                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-400">
                    Programa de fidelidade
                  </p>
                </div>

                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                  Pontos do cliente
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  A cada R$ 5,00 em produtos, o cliente recebe 1 ponto. A cada
                  500 pontos, ganha R$ 5,00 de desconto.
                </p>
              </div>

              <div className="rounded-[20px] border border-amber-400/15 bg-amber-400/[0.06] px-5 py-4 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-400">
                  Saldo atual
                </p>

                <p className="mt-1 text-4xl font-black tracking-[-0.06em] text-white">
                  {pontosSaldo}
                </p>

                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                  pontos
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {/* PRÓXIMO PONTO */}
              <div className="rounded-[22px] border border-white/[0.06] bg-black/20 p-5">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                  Próximo ponto
                </p>

                <p className="mt-2 text-xl font-black text-white">
                  Faltam {formatarPreco(valorFaltanteProximoPonto)}
                </p>

                <p className="mt-1 text-[9px] text-zinc-600">
                  em compras para gerar +1 ponto
                </p>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{
                      width: `${percentualProximoPonto}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-[8px] font-bold text-zinc-700">
                  R$ {(progressoCentavos / 100).toFixed(2).replace(".", ",")} de
                  R$ 5,00 acumulados
                </p>
              </div>

              {/* PRÓXIMO DESCONTO */}
              <div className="rounded-[22px] border border-violet-400/10 bg-violet-400/[0.025] p-5">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-violet-300">
                  Próximo benefício
                </p>

                <p className="mt-2 text-xl font-black text-white">
                  {pontosAteProximoDesconto} pontos
                </p>

                <p className="mt-1 text-[9px] text-zinc-600">
                  até mais R$ 5,00 de desconto
                </p>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div
                    className="h-full rounded-full bg-violet-400 transition-all duration-500"
                    style={{
                      width: `${percentualDesconto}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-[8px] font-bold text-zinc-700">
                  {pontosSaldo % 500} de 500 pontos
                </p>
              </div>

              {/* DESCONTO DISPONÍVEL */}
              <div
                className={`rounded-[22px] border p-5 ${
                  valorDescontoDisponivel > 0
                    ? "border-emerald-400/20 bg-emerald-400/[0.05]"
                    : "border-white/[0.06] bg-black/20"
                }`}
              >
                <p
                  className={`text-[8px] font-black uppercase tracking-[0.12em] ${
                    valorDescontoDisponivel > 0
                      ? "text-emerald-400"
                      : "text-zinc-600"
                  }`}
                >
                  Desconto disponível
                </p>

                <p
                  className={`mt-2 text-2xl font-black ${
                    valorDescontoDisponivel > 0
                      ? "text-emerald-400"
                      : "text-white"
                  }`}
                >
                  {formatarPreco(valorDescontoDisponivel)}
                </p>

                <p className="mt-1 text-[9px] text-zinc-600">
                  {valorDescontoDisponivel > 0
                    ? "benefício disponível para resgate"
                    : "nenhum benefício disponível ainda"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-amber-400/[0.08] pt-4">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

              <p className="text-[7px] font-black uppercase tracking-[0.12em] text-zinc-700">
                Pontos creditados somente quando o pedido é entregue
              </p>
            </div>
          </div>
        </section>

        {/* EXTRATO DE FIDELIDADE */}
        <section className="mt-6 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-amber-400">
                  Histórico de pontos
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">
                Extrato de fidelidade
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Créditos, resgates, estornos e ajustes realizados no programa.
              </p>
            </div>

            <span className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">
              {movimentacoesFidelidade.length}{" "}
              {movimentacoesFidelidade.length === 1
                ? "movimentação"
                : "movimentações"}
            </span>
          </div>

          {movimentacoesFidelidade.length === 0 ? (
            <div className="mt-6 rounded-[20px] border border-white/[0.05] bg-black/20 p-5">
              <p className="text-sm font-bold text-zinc-400">
                Nenhuma movimentação registrada.
              </p>

              <p className="mt-1 text-[10px] text-zinc-600">
                Os lançamentos aparecerão aqui quando o cliente ganhar ou
                utilizar pontos.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {movimentacoesFidelidade.map((movimentacao) => {
                const visual = visualizarMovimentacaoFidelidade(
                  movimentacao.tipo,
                );

                const pontos = Number(movimentacao.pontos ?? 0);

                const valorReferencia = Number(
                  movimentacao.valor_referencia ?? 0,
                );

                return (
                  <div
                    key={movimentacao.id}
                    className={`rounded-[22px] border p-5 ${visual.estilo}`}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-current/10 bg-black/20 text-lg font-black ${visual.cor}`}
                        >
                          {visual.icone}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-white">
                              {visual.titulo}
                            </p>

                            {movimentacao.pedido_id ? (
                              <Link
                                href={`/admin/pedidos/${movimentacao.pedido_id}`}
                                className="rounded-full border border-white/[0.07] bg-black/20 px-3 py-1 text-[8px] font-black text-zinc-500 transition hover:border-amber-400/25 hover:text-amber-400"
                              >
                                Pedido #{movimentacao.pedido_id}
                              </Link>
                            ) : (
                              <span className="rounded-full border border-white/[0.05] px-3 py-1 text-[8px] font-black text-zinc-600">
                                Sem pedido
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-[10px] text-zinc-500">
                            {formatarDataHora(movimentacao.created_at)}
                          </p>

                          {movimentacao.observacao ? (
                            <p className="mt-2 max-w-2xl text-[10px] leading-5 text-zinc-600">
                              {movimentacao.observacao}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-6 lg:text-right">
                        {valorReferencia > 0 ? (
                          <div>
                            <p className="text-[7px] font-black uppercase tracking-[0.1em] text-zinc-600">
                              Referência
                            </p>

                            <p className="mt-1 text-sm font-black text-zinc-300">
                              {formatarPreco(valorReferencia)}
                            </p>
                          </div>
                        ) : null}

                        <div>
                          <p className="text-[7px] font-black uppercase tracking-[0.1em] text-zinc-600">
                            Pontos
                          </p>

                          <p
                            className={`mt-1 text-2xl font-black ${
                              pontos > 0
                                ? "text-emerald-400"
                                : pontos < 0
                                  ? "text-red-400"
                                  : "text-zinc-400"
                            }`}
                          >
                            {pontos > 0 ? "+" : ""}
                            {pontos}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* CONTATO + RELACIONAMENTO */}
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="relative overflow-hidden rounded-[26px] border border-emerald-400/10 bg-emerald-400/[0.025] p-6">
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-emerald-400/15 bg-emerald-400/[0.07] text-lg">
                💬
              </div>

              <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.05] px-3 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-400">
                WhatsApp
              </span>
            </div>

            <p className="mt-5 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
              Contato do cliente
            </p>

            <p className="mt-1 text-xl font-black">
              {formatarTelefone(cliente.telefone)}
            </p>

            <a
              href={linkWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-12 items-center justify-center gap-3 rounded-[16px] bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              💬 Chamar no WhatsApp →
            </a>
          </div>

          <div className="rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-6">
            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-violet-300">
              Relacionamento
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex justify-between gap-4 border-b border-white/[0.05] pb-4">
                <span className="text-sm text-zinc-500">Cliente desde</span>

                <span className="text-sm font-black">
                  {formatarData(cliente.created_at)}
                </span>
              </div>

              <div className="flex justify-between gap-4 border-b border-white/[0.05] pb-4">
                <span className="text-sm text-zinc-500">Primeira compra</span>

                <span className="text-sm font-black">
                  {formatarData(primeiraCompra)}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-sm text-zinc-500">Última compra</span>

                <span className="text-sm font-black text-amber-400">
                  {formatarData(ultimaCompra)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUTOS FAVORITOS */}
        <section className="mt-6 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-6">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-300">
              Preferências de compra
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Produtos mais comprados
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Ranking baseado na quantidade comprada em pedidos não cancelados.
            </p>
          </div>

          {produtosMaisComprados.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-white/[0.05] bg-black/20 p-5 text-sm text-zinc-600">
              Ainda não existem produtos suficientes para gerar o ranking.
            </p>
          ) : (
            <div className="mt-6 grid gap-3">
              {produtosMaisComprados.map((produto, indice) => (
                <div
                  key={produto.nome}
                  className="flex flex-col gap-4 rounded-[20px] border border-white/[0.06] bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-violet-400/15 bg-violet-400/[0.06] text-sm font-black text-violet-300">
                      {indice + 1}
                    </div>

                    <div>
                      <p className="font-black">{produto.nome}</p>

                      <p className="mt-1 text-[9px] text-zinc-600">
                        {produto.quantidade} unidades compradas
                      </p>
                    </div>
                  </div>

                  <p className="font-black text-emerald-400">
                    {formatarPreco(produto.totalGasto)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* HISTÓRICO */}
        <section className="mt-6 rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-300">
                Histórico completo
              </p>

              <h2 className="mt-1 text-2xl font-black">Pedidos do cliente</h2>
            </div>

            <span className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">
              {pedidos.length}{" "}
              {pedidos.length === 1
                ? "pedido registrado"
                : "pedidos registrados"}
            </span>
          </div>

          {pedidos.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">
              Nenhum pedido registrado.
            </p>
          ) : (
            <div className="mt-6 space-y-3">
              {pedidos.map((pedido) => {
                const cancelado = pedido.status === "cancelado";

                return (
                  <div
                    key={pedido.id}
                    className={`rounded-[22px] border p-5 ${
                      cancelado
                        ? "border-red-400/10 bg-red-400/[0.025]"
                        : "border-white/[0.06] bg-black/20"
                    }`}
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-black">
                            Pedido #{pedido.id}
                          </span>

                          <span className="rounded-full border border-white/[0.06] px-3 py-1 text-[8px] font-black text-zinc-500">
                            {formatarStatus(pedido.status)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-zinc-500">
                          {formatarDataHora(pedido.created_at)}
                        </p>

                        <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-600">
                          {formatarPagamento(pedido.forma_pagamento)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase text-zinc-600">
                            Total
                          </p>

                          <p
                            className={`mt-1 text-xl font-black ${
                              cancelado ? "text-red-400" : "text-white"
                            }`}
                          >
                            {formatarPreco(Number(pedido.total))}
                          </p>
                        </div>

                        <Link
                          href={`/admin/pedidos/${pedido.id}`}
                          className="rounded-[14px] border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-xs font-black text-zinc-300 transition hover:border-amber-400/30 hover:text-amber-400"
                        >
                          Ver pedido →
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

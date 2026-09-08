import Link from "next/link";
import { redirect } from "next/navigation";

import { verificarAdmin } from "../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import AdminNavigation from "../../components/AdminNavigation";
import AdminAutoRefresh from "../../components/AdminAutoRefresh";

export const dynamic = "force-dynamic";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarStatus(status: string) {
  if (status === "recebido") {
    return "🟡 Recebido";
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

function formatarDataHora(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

export default async function AdminPage() {
  // -----------------------------------------
  // 1. Proteção do painel administrativo
  // -----------------------------------------

  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  // -----------------------------------------
  // 2. Início e fim do dia no Brasil
  // -----------------------------------------

  const dataHojeBrasil = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const inicioHoje = new Date(`${dataHojeBrasil}T00:00:00-03:00`);

  const fimHoje = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);
  const inicioUltimos7Dias = new Date(
    inicioHoje.getTime() - 6 * 24 * 60 * 60 * 1000,
  );

  // -----------------------------------------
  // 3. Busca os dados do dashboard
  // -----------------------------------------

  const { data: ultimoPedido } = await supabaseAdmin
    .from("pedidos")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ultimoPedidoId = Number(ultimoPedido?.id ?? 0);

  const [
    resultadoPedidosHoje,
    resultadoPedidosAbertos,
    resultadoUltimosPedidos,
    resultadoProdutos,
    resultadoPedidosUltimos7Dias,
  ] = await Promise.all([
    supabaseAdmin
      .from("pedidos")
      .select("id, total, status")
      .gte("created_at", inicioHoje.toISOString())
      .lt("created_at", fimHoje.toISOString()),

    supabaseAdmin
      .from("pedidos")
      .select("id, status, forma_pagamento, pagamento_confirmado")
      .in("status", ["recebido", "em_preparacao", "saiu_entrega"]),

    supabaseAdmin
      .from("pedidos")
      .select(
        `
          id,
          created_at,
          nome_cliente,
          total,
          status
        `,
      )
      .order("created_at", { ascending: false })
      .limit(5),

    supabaseAdmin
      .from("produtos")
      .select(
        `
      id,
      nome,
      estoque,
      estoque_minimo,
      ativo
    `,
      )
      .eq("ativo", true)
      .order("estoque", { ascending: true }),

    supabaseAdmin
      .from("pedidos")
      .select("id, created_at, total, status, forma_pagamento, bairro")
      .gte("created_at", inicioUltimos7Dias.toISOString())
      .lt("created_at", fimHoje.toISOString()),
  ]);

  const pedidosHoje = resultadoPedidosHoje.data ?? [];
  const pedidosAbertos = resultadoPedidosAbertos.data ?? [];
  const ultimosPedidos = resultadoUltimosPedidos.data ?? [];
  const produtos = resultadoProdutos.data ?? [];
  const pedidosUltimos7Dias = resultadoPedidosUltimos7Dias.data ?? [];
  const idsPedidosValidosUltimos7Dias = pedidosUltimos7Dias
    .filter((pedido) => pedido.status !== "cancelado")
    .map((pedido) => pedido.id);

  let itensUltimos7Dias: {
    produto_id: number;
    nome_produto: string;
    quantidade: number;
  }[] = [];

  if (idsPedidosValidosUltimos7Dias.length > 0) {
    const { data: itensPeriodo } = await supabaseAdmin
      .from("itens_pedido")
      .select("produto_id, nome_produto, quantidade")
      .in("pedido_id", idsPedidosValidosUltimos7Dias);

    itensUltimos7Dias = itensPeriodo ?? [];
  }

  // -----------------------------------------
  // 4. Calcula os indicadores
  // -----------------------------------------

  const quantidadePedidosHoje = pedidosHoje.length;

  const pedidosValidosHoje = pedidosHoje.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const quantidadePedidosValidosHoje = pedidosValidosHoje.length;

  const faturamentoHoje = pedidosHoje.reduce((total, pedido) => {
    if (pedido.status === "cancelado") {
      return total;
    }

    return total + Number(pedido.total);
  }, 0);

  const ticketMedioHoje =
    quantidadePedidosValidosHoje > 0
      ? faturamentoHoje / quantidadePedidosValidosHoje
      : 0;

  const quantidadeRecebidos = pedidosAbertos.filter(
    (pedido) => pedido.status === "recebido",
  ).length;

  const quantidadeEmAndamento = pedidosAbertos.filter(
    (pedido) =>
      pedido.status === "em_preparacao" || pedido.status === "saiu_entrega",
  ).length;

  const quantidadePixPendentes = pedidosAbertos.filter(
    (pedido) =>
      pedido.forma_pagamento === "pix" && pedido.pagamento_confirmado === false,
  ).length;

  const produtosEstoqueBaixo = produtos.filter(
    (produto) => Number(produto.estoque) <= Number(produto.estoque_minimo),
  );

  const formatadorDataBanco = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  });

  const formatadorDiaMes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });

  const dadosUltimos7Dias = Array.from({ length: 7 }, (_, indice) => {
    const data = new Date(
      inicioUltimos7Dias.getTime() + indice * 24 * 60 * 60 * 1000,
    );

    const chaveData = formatadorDataBanco.format(data);

    const pedidosDoDia = pedidosUltimos7Dias.filter((pedido) => {
      const dataPedido = formatadorDataBanco.format(
        new Date(pedido.created_at),
      );

      return dataPedido === chaveData && pedido.status !== "cancelado";
    });

    const faturamento = pedidosDoDia.reduce(
      (total, pedido) => total + Number(pedido.total),
      0,
    );

    return {
      data: chaveData,
      label: formatadorDiaMes.format(data),
      quantidadePedidos: pedidosDoDia.length,
      faturamento,
    };
  });

  const maiorFaturamento7Dias = Math.max(
    ...dadosUltimos7Dias.map((dia) => dia.faturamento),
    1,
  );

  const faturamentoUltimos7Dias = dadosUltimos7Dias.reduce(
    (total, dia) => total + dia.faturamento,
    0,
  );

  const quantidadePedidosUltimos7Dias = dadosUltimos7Dias.reduce(
    (total, dia) => total + dia.quantidadePedidos,
    0,
  );

  const ticketMedioUltimos7Dias =
    quantidadePedidosUltimos7Dias > 0
      ? faturamentoUltimos7Dias / quantidadePedidosUltimos7Dias
      : 0;

  const pedidosValidosUltimos7Dias = pedidosUltimos7Dias.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const quantidadePix7Dias = pedidosValidosUltimos7Dias.filter(
    (pedido) => pedido.forma_pagamento === "pix",
  ).length;

  const quantidadeDinheiro7Dias = pedidosValidosUltimos7Dias.filter(
    (pedido) => pedido.forma_pagamento === "dinheiro",
  ).length;

  const quantidadeCartao7Dias = pedidosValidosUltimos7Dias.filter(
    (pedido) => pedido.forma_pagamento === "cartao_entrega",
  ).length;

  const totalPagamentos7Dias = pedidosValidosUltimos7Dias.length;

  const percentualPix7Dias =
    totalPagamentos7Dias > 0
      ? (quantidadePix7Dias / totalPagamentos7Dias) * 100
      : 0;

  const percentualDinheiro7Dias =
    totalPagamentos7Dias > 0
      ? (quantidadeDinheiro7Dias / totalPagamentos7Dias) * 100
      : 0;

  const percentualCartao7Dias =
    totalPagamentos7Dias > 0
      ? (quantidadeCartao7Dias / totalPagamentos7Dias) * 100
      : 0;

  const vendasPorProduto = new Map<
    number,
    {
      nome: string;
      quantidade: number;
    }
  >();

  const faturamentoPix7Dias = pedidosValidosUltimos7Dias
    .filter((pedido) => pedido.forma_pagamento === "pix")
    .reduce((total, pedido) => total + Number(pedido.total), 0);

  const faturamentoDinheiro7Dias = pedidosValidosUltimos7Dias
    .filter((pedido) => pedido.forma_pagamento === "dinheiro")
    .reduce((total, pedido) => total + Number(pedido.total), 0);

  const faturamentoCartao7Dias = pedidosValidosUltimos7Dias
    .filter((pedido) => pedido.forma_pagamento === "cartao_entrega")
    .reduce((total, pedido) => total + Number(pedido.total), 0);

  for (const item of itensUltimos7Dias) {
    const produtoAtual = vendasPorProduto.get(item.produto_id);

    if (produtoAtual) {
      produtoAtual.quantidade += Number(item.quantidade);
    } else {
      vendasPorProduto.set(item.produto_id, {
        nome: item.nome_produto,
        quantidade: Number(item.quantidade),
      });
    }
  }

  const quantidadeCancelados7Dias = pedidosUltimos7Dias.filter(
    (pedido) => pedido.status === "cancelado",
  ).length;

  const quantidadeTotalPedidos7Dias = pedidosUltimos7Dias.length;

  const taxaCancelamento7Dias =
    quantidadeTotalPedidos7Dias > 0
      ? (quantidadeCancelados7Dias / quantidadeTotalPedidos7Dias) * 100
      : 0;

  const produtoMaisVendidoUltimos7Dias =
    Array.from(vendasPorProduto.values()).sort(
      (a, b) => b.quantidade - a.quantidade,
    )[0] ?? null;

  const rankingProdutosUltimos7Dias = Array.from(vendasPorProduto.values())
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);

  const pedidosPorHora = new Map<number, number>();

  for (const pedido of pedidosValidosUltimos7Dias) {
    const hora = Number(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false,
      }).format(new Date(pedido.created_at)),
    );

    pedidosPorHora.set(hora, (pedidosPorHora.get(hora) ?? 0) + 1);
  }

  const horarioPicoUltimos7Dias =
    Array.from(pedidosPorHora.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const pedidosPorBairro = new Map<string, number>();

  for (const pedido of pedidosValidosUltimos7Dias) {
    const bairro = pedido.bairro?.trim() || "Não informado";

    pedidosPorBairro.set(bairro, (pedidosPorBairro.get(bairro) ?? 0) + 1);
  }

  const bairroMaisPedidosUltimos7Dias =
    Array.from(pedidosPorBairro.entries()).sort((a, b) => b[1] - a[1])[0] ??
    null;

  // -----------------------------------------
  // 5. Dashboard
  // -----------------------------------------

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />
        <AdminAutoRefresh ultimoPedidoId={ultimoPedidoId} />

        <div className="mt-2">
          <p className="text-sm font-black uppercase tracking-widest text-amber-400">
            Visão geral
          </p>

          <h1 className="mt-2 text-4xl font-black">Dashboard</h1>

          <p className="mt-2 text-zinc-400">
            Acompanhe rapidamente a operação do Depósito do Zé.
          </p>
        </div>

        {/* INDICADORES */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-black text-zinc-400">
              📦 Pedidos de hoje
            </p>

            <p className="mt-2 text-3xl font-black">{quantidadePedidosHoje}</p>

            <p className="mt-1 text-sm text-zinc-500">pedidos recebidos hoje</p>
          </div>

          <div className="rounded-2xl border border-green-900/60 bg-green-950/20 p-5">
            <p className="text-sm font-black text-green-400">
              💰 Faturamento de hoje
            </p>

            <p className="mt-2 text-3xl font-black">
              {formatarPreco(faturamentoHoje)}
            </p>

            <p className="mt-1 text-sm text-zinc-400">
              cancelados não contabilizados
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
            <p className="text-sm font-black text-cyan-400">📈 Ticket médio</p>

            <p className="mt-2 text-3xl font-black">
              {formatarPreco(ticketMedioHoje)}
            </p>

            <p className="mt-1 text-sm text-zinc-400">média por pedido hoje</p>
          </div>

          <Link
            href="/admin/pedidos?status=recebido"
            className="rounded-2xl border border-amber-900/60 bg-amber-950/20 p-5 transition hover:border-amber-400"
          >
            <p className="text-sm font-black text-amber-400">
              🟡 Novos pedidos
            </p>

            <p className="mt-2 text-3xl font-black">{quantidadeRecebidos}</p>

            <p className="mt-1 text-sm text-zinc-400">aguardando atendimento</p>
          </Link>

          <Link
            href="/admin/pedidos"
            className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-5 transition hover:border-blue-400"
          >
            <p className="text-sm font-black text-blue-400">🚚 Em andamento</p>

            <p className="mt-2 text-3xl font-black">{quantidadeEmAndamento}</p>

            <p className="mt-1 text-sm text-zinc-400">preparação ou entrega</p>
          </Link>
          <Link
            href="/admin/pedidos?pagamento=pix_pendente"
            className="rounded-2xl border border-purple-900/60 bg-purple-950/20 p-5 transition hover:border-purple-400"
          >
            <p className="text-sm font-black text-purple-400">
              💳 PIX pendente
            </p>

            <p className="mt-2 text-3xl font-black">{quantidadePixPendentes}</p>

            <p className="mt-1 text-sm text-zinc-400">aguardando confirmação</p>
          </Link>
        </div>

        {/* DESEMPENHO DOS ÚLTIMOS 7 DIAS */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-amber-400">
              📊 Desempenho
            </p>

            <h2 className="mt-1 text-2xl font-black">Últimos 7 dias</h2>

            <p className="mt-2 text-sm text-zinc-400">
              Pedidos e faturamento diário, desconsiderando cancelamentos.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm font-black text-zinc-400">
                💰 Faturamento no período
              </p>

              <p className="mt-2 text-2xl font-black text-green-400">
                {formatarPreco(faturamentoUltimos7Dias)}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm font-black text-zinc-400">
                📦 Pedidos no período
              </p>

              <p className="mt-2 text-2xl font-black">
                {quantidadePedidosUltimos7Dias}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <p className="text-sm font-black text-zinc-400">
                📈 Ticket médio no período
              </p>

              <p className="mt-2 text-2xl font-black text-cyan-400">
                {formatarPreco(ticketMedioUltimos7Dias)}
              </p>
            </div>

            <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
              <p className="text-sm font-black text-amber-400">
                🏆 Produto mais vendido
              </p>

              {produtoMaisVendidoUltimos7Dias ? (
                <>
                  <p className="mt-2 text-xl font-black">
                    {produtoMaisVendidoUltimos7Dias.nome}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {produtoMaisVendidoUltimos7Dias.quantidade}{" "}
                    {produtoMaisVendidoUltimos7Dias.quantidade === 1
                      ? "unidade vendida"
                      : "unidades vendidas"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  Nenhuma venda no período.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-red-900/60 bg-red-950/20 p-4">
              <p className="text-sm font-black text-red-400">
                🚫 Taxa de cancelamento
              </p>

              <p className="mt-2 text-2xl font-black">
                {taxaCancelamento7Dias.toFixed(1)}%
              </p>

              <p className="mt-1 text-sm text-zinc-400">
                {quantidadeCancelados7Dias}{" "}
                {quantidadeCancelados7Dias === 1
                  ? "pedido cancelado"
                  : "pedidos cancelados"}{" "}
                de {quantidadeTotalPedidos7Dias}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex h-56 items-end gap-3">
              {dadosUltimos7Dias.map((dia) => {
                const percentual =
                  dia.faturamento > 0
                    ? Math.max(
                        (dia.faturamento / maiorFaturamento7Dias) * 100,
                        6,
                      )
                    : 2;

                return (
                  <div
                    key={dia.data}
                    className="flex h-full flex-1 flex-col justify-end"
                  >
                    <div className="mb-2 text-center">
                      <p className="text-xs font-black text-green-400">
                        {formatarPreco(dia.faturamento)}
                      </p>
                    </div>

                    <div className="flex h-40 items-end">
                      <div
                        className="w-full rounded-t-lg bg-amber-400 transition-all"
                        style={{
                          height: `${percentual}%`,
                        }}
                      />
                    </div>

                    <p className="mt-3 text-center text-xs font-black text-zinc-400">
                      {dia.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {dadosUltimos7Dias.map((dia) => (
              <div
                key={dia.data}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
              >
                <p className="text-sm font-black text-amber-400">{dia.label}</p>

                <p className="mt-3 text-2xl font-black">
                  {dia.quantidadePedidos}
                </p>

                <p className="text-xs text-zinc-500">
                  {dia.quantidadePedidos === 1
                    ? "1 pedido"
                    : `${dia.quantidadePedidos} pedidos`}
                </p>

                <p className="mt-3 font-black text-green-400">
                  {formatarPreco(dia.faturamento)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-amber-400">
              🏆 Ranking de vendas
            </p>

            <h2 className="mt-1 text-2xl font-black">Produtos mais vendidos</h2>

            <p className="mt-2 text-sm text-zinc-400">
              Ranking dos últimos 7 dias, desconsiderando pedidos cancelados.
            </p>
          </div>

          {rankingProdutosUltimos7Dias.length === 0 ? (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-zinc-400">
                Nenhuma venda registrada no período.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {rankingProdutosUltimos7Dias.map((produto, indice) => (
                <div
                  key={produto.nome}
                  className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 font-black text-zinc-950">
                      {indice + 1}
                    </div>

                    <div>
                      <p className="font-black">{produto.nome}</p>

                      <p className="mt-1 text-xs text-zinc-500">
                        posição no ranking
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-black text-amber-400">
                      {produto.quantidade}
                    </p>

                    <p className="text-xs text-zinc-500">
                      {produto.quantidade === 1
                        ? "unidade vendida"
                        : "unidades vendidas"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-amber-400">
              💳 Pagamentos
            </p>

            <h2 className="mt-1 text-2xl font-black">Formas de pagamento</h2>

            <p className="mt-2 text-sm text-zinc-400">
              Distribuição dos pedidos válidos nos últimos 7 dias.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-black">PIX</p>

                  <p className="text-xs text-zinc-500">
                    {quantidadePix7Dias}{" "}
                    {quantidadePix7Dias === 1 ? "pedido" : "pedidos"} ·{" "}
                    {formatarPreco(faturamentoPix7Dias)}
                  </p>
                </div>

                <p className="font-black text-purple-400">
                  {percentualPix7Dias.toFixed(0)}%
                </p>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-purple-500"
                  style={{
                    width: `${percentualPix7Dias}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-black">Dinheiro</p>

                  <p className="text-xs text-zinc-500">
                    {quantidadeDinheiro7Dias}{" "}
                    {quantidadeDinheiro7Dias === 1 ? "pedido" : "pedidos"} ·{" "}
                    {formatarPreco(faturamentoDinheiro7Dias)}
                  </p>
                </div>

                <p className="font-black text-green-400">
                  {percentualDinheiro7Dias.toFixed(0)}%
                </p>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{
                    width: `${percentualDinheiro7Dias}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-black">Cartão na entrega</p>

                  <p className="text-xs text-zinc-500">
                    {quantidadeCartao7Dias}{" "}
                    {quantidadeCartao7Dias === 1 ? "pedido" : "pedidos"} ·{" "}
                    {formatarPreco(faturamentoCartao7Dias)}
                  </p>
                </div>

                <p className="font-black text-blue-400">
                  {percentualCartao7Dias.toFixed(0)}%
                </p>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${percentualCartao7Dias}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-amber-400">
              🕒 Comportamento dos pedidos
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Horário e região de maior movimento
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Análise dos pedidos válidos realizados nos últimos 7 dias.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              {horarioPicoUltimos7Dias ? (
                <>
                  <p className="text-sm font-black text-zinc-400">
                    🔥 Maior movimento
                  </p>

                  <p className="mt-2 text-3xl font-black text-amber-400">
                    {String(horarioPicoUltimos7Dias[0]).padStart(2, "0")}:00
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {horarioPicoUltimos7Dias[1]}{" "}
                    {horarioPicoUltimos7Dias[1] === 1
                      ? "pedido nesse horário"
                      : "pedidos nesse horário"}
                  </p>
                </>
              ) : (
                <p className="text-zinc-400">
                  Nenhum pedido válido registrado no período.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
              {bairroMaisPedidosUltimos7Dias ? (
                <>
                  <p className="text-sm font-black text-zinc-400">
                    📍 Bairro com mais pedidos
                  </p>

                  <p className="mt-2 text-2xl font-black text-blue-400">
                    {bairroMaisPedidosUltimos7Dias[0]}
                  </p>

                  <p className="mt-1 text-sm text-zinc-400">
                    {bairroMaisPedidosUltimos7Dias[1]}{" "}
                    {bairroMaisPedidosUltimos7Dias[1] === 1
                      ? "pedido no período"
                      : "pedidos no período"}
                  </p>
                </>
              ) : (
                <p className="text-zinc-400">
                  Nenhum bairro registrado no período.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ESTOQUE + ACESSOS */}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-red-400">
                  ⚠️ Estoque
                </p>

                <h2 className="mt-1 text-2xl font-black">Estoque baixo</h2>
              </div>

              <Link
                href="/admin/estoque"
                className="text-sm font-bold text-amber-400 transition hover:text-amber-300"
              >
                Ver estoque →
              </Link>
            </div>

            {produtosEstoqueBaixo.length === 0 ? (
              <div className="mt-6 rounded-xl border border-green-900/50 bg-green-950/20 p-5">
                <p className="font-bold text-green-400">
                  ✅ Nenhum produto com estoque baixo.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {produtosEstoqueBaixo.slice(0, 6).map((produto) => (
                  <div
                    key={produto.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div>
                      <p className="font-bold">{produto.nome}</p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Mínimo: {produto.estoque_minimo}
                      </p>
                    </div>

                    <p className="font-black text-red-400">
                      {produto.estoque} un.
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-black uppercase tracking-wider text-amber-400">
              Atalhos
            </p>

            <h2 className="mt-1 text-2xl font-black">Acessos rápidos</h2>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/admin/pedidos"
                className="rounded-xl border border-zinc-700 bg-zinc-950 p-5 font-black transition hover:border-amber-400 hover:text-amber-400"
              >
                📦 Pedidos
              </Link>

              <Link
                href="/admin/produtos"
                className="rounded-xl border border-zinc-700 bg-zinc-950 p-5 font-black transition hover:border-amber-400 hover:text-amber-400"
              >
                🍺 Produtos
              </Link>

              <Link
                href="/admin/estoque"
                className="rounded-xl border border-zinc-700 bg-zinc-950 p-5 font-black transition hover:border-amber-400 hover:text-amber-400"
              >
                📊 Estoque
              </Link>

              <Link
                href="/admin/estoque/movimentacoes"
                className="rounded-xl border border-zinc-700 bg-zinc-950 p-5 font-black transition hover:border-amber-400 hover:text-amber-400"
              >
                📋 Movimentações
              </Link>
            </div>
          </section>
        </div>

        {/* ÚLTIMOS PEDIDOS */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-amber-400">
                Pedidos
              </p>

              <h2 className="mt-1 text-2xl font-black">Últimos pedidos</h2>
            </div>

            <Link
              href="/admin/pedidos"
              className="text-sm font-bold text-amber-400 transition hover:text-amber-300"
            >
              Ver todos →
            </Link>
          </div>

          {ultimosPedidos.length === 0 ? (
            <p className="mt-6 text-zinc-400">Nenhum pedido recebido ainda.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {ultimosPedidos.map((pedido) => (
                <Link
                  key={pedido.id}
                  href={`/admin/pedidos/${pedido.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-amber-400 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-black text-amber-400">
                      PEDIDO #{pedido.id}
                    </p>

                    <p className="mt-1 font-bold">{pedido.nome_cliente}</p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {formatarDataHora(pedido.created_at)}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="font-black">
                      {formatarPreco(Number(pedido.total))}
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      {formatarStatus(pedido.status)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

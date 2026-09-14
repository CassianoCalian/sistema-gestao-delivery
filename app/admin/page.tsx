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

  const inicioUltimos30Dias = new Date(
    inicioHoje.getTime() - 29 * 24 * 60 * 60 * 1000,
  );

  const inicio7DiasAnteriores = new Date(
    inicioUltimos7Dias.getTime() - 7 * 24 * 60 * 60 * 1000,
  );

  const anoAtual = Number(dataHojeBrasil.slice(0, 4));
  const mesAtual = Number(dataHojeBrasil.slice(5, 7));

  const formatarInicioMesBrasil = (ano: number, mes: number) => {
    const referencia = new Date(Date.UTC(ano, mes - 1, 1));

    const anoFormatado = referencia.getUTCFullYear();
    const mesFormatado = String(referencia.getUTCMonth() + 1).padStart(2, "0");

    return new Date(`${anoFormatado}-${mesFormatado}-01T00:00:00-03:00`);
  };

  const inicioMesAtual = formatarInicioMesBrasil(anoAtual, mesAtual);

  const inicioProximoMes = formatarInicioMesBrasil(anoAtual, mesAtual + 1);

  const inicioMesAnterior = formatarInicioMesBrasil(anoAtual, mesAtual - 1);

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
    resultadoPedidos7DiasAnteriores,
    resultadoPedidosClientes,
    resultadoClientesCadastro,
    resultadoPedidosMesAtual,
    resultadoPedidosMesAnterior,
  ] = await Promise.all([
    // PEDIDOS DE HOJE
    supabaseAdmin
      .from("pedidos")
      .select("id, total, status")
      .gte("created_at", inicioHoje.toISOString())
      .lt("created_at", fimHoje.toISOString()),

    // PEDIDOS ABERTOS
    supabaseAdmin
      .from("pedidos")
      .select("id, status, forma_pagamento, pagamento_confirmado")
      .in("status", ["recebido", "em_preparacao", "saiu_entrega"]),

    // ÚLTIMOS PEDIDOS
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

    // PRODUTOS
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

    // ÚLTIMOS 7 DIAS
    supabaseAdmin
      .from("pedidos")
      .select("id, created_at, total, status, forma_pagamento, bairro")
      .gte("created_at", inicioUltimos7Dias.toISOString())
      .lt("created_at", fimHoje.toISOString()),

    // 7 DIAS ANTERIORES
    supabaseAdmin
      .from("pedidos")
      .select("id, created_at, total, status")
      .gte("created_at", inicio7DiasAnteriores.toISOString())
      .lt("created_at", inicioUltimos7Dias.toISOString()),

    // HISTÓRICO PARA INTELIGÊNCIA DE CLIENTES
    supabaseAdmin
      .from("pedidos")
      .select("id, cliente_id, created_at, total, status")
      .not("cliente_id", "is", null)
      .order("created_at", { ascending: true }),

    // CADASTRO DE CLIENTES
    supabaseAdmin.from("clientes").select("id, nome, telefone, pontos_saldo"),

    // PEDIDOS DO MÊS ATUAL
    supabaseAdmin
      .from("pedidos")
      .select("id, created_at, total, status")
      .gte("created_at", inicioMesAtual.toISOString())
      .lt("created_at", fimHoje.toISOString()),

    // PEDIDOS DO MÊS ANTERIOR
    supabaseAdmin
      .from("pedidos")
      .select("id, created_at, total, status")
      .gte("created_at", inicioMesAnterior.toISOString())
      .lt("created_at", inicioMesAtual.toISOString()),
  ]);

  const pedidosHoje = resultadoPedidosHoje.data ?? [];
  const pedidosAbertos = resultadoPedidosAbertos.data ?? [];
  const ultimosPedidos = resultadoUltimosPedidos.data ?? [];
  const produtos = resultadoProdutos.data ?? [];
  const pedidosUltimos7Dias = resultadoPedidosUltimos7Dias.data ?? [];
  const pedidos7DiasAnteriores = resultadoPedidos7DiasAnteriores.data ?? [];
  const pedidosClientes = resultadoPedidosClientes.data ?? [];
  const clientesCadastro = resultadoClientesCadastro.data ?? [];
  const pedidosMesAtual = resultadoPedidosMesAtual.data ?? [];
  const pedidosMesAnterior = resultadoPedidosMesAnterior.data ?? [];
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

  const pedidosValidos7DiasAnteriores = pedidos7DiasAnteriores.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const quantidadePedidos7DiasAnteriores = pedidosValidos7DiasAnteriores.length;

  const faturamento7DiasAnteriores = pedidosValidos7DiasAnteriores.reduce(
    (total, pedido) => total + Number(pedido.total),
    0,
  );

  const ticketMedio7DiasAnteriores =
    quantidadePedidos7DiasAnteriores > 0
      ? faturamento7DiasAnteriores / quantidadePedidos7DiasAnteriores
      : 0;

  const calcularVariacaoPercentual = (
    valorAtual: number,
    valorAnterior: number,
  ) => {
    if (valorAnterior === 0) {
      if (valorAtual === 0) {
        return 0;
      }

      return null;
    }

    return ((valorAtual - valorAnterior) / valorAnterior) * 100;
  };

  const variacaoFaturamento7Dias = calcularVariacaoPercentual(
    faturamentoUltimos7Dias,
    faturamento7DiasAnteriores,
  );

  const variacaoPedidos7Dias = calcularVariacaoPercentual(
    quantidadePedidosUltimos7Dias,
    quantidadePedidos7DiasAnteriores,
  );

  const variacaoTicketMedio7Dias = calcularVariacaoPercentual(
    ticketMedioUltimos7Dias,
    ticketMedio7DiasAnteriores,
  );

  const obterComparacaoPeriodo = (variacao: number | null) => {
    if (variacao === null) {
      return {
        texto: "Sem base anterior",
        simbolo: "●",
        classe: "text-amber-400",
        fundo: "border-amber-400/15 bg-amber-400/[0.06]",
      };
    }

    if (variacao > 0) {
      return {
        texto: `+${variacao.toFixed(1)}%`,
        simbolo: "▲",
        classe: "text-emerald-400",
        fundo: "border-emerald-400/15 bg-emerald-400/[0.06]",
      };
    }

    if (variacao < 0) {
      return {
        texto: `${variacao.toFixed(1)}%`,
        simbolo: "▼",
        classe: "text-red-400",
        fundo: "border-red-400/15 bg-red-400/[0.06]",
      };
    }

    return {
      texto: "0,0%",
      simbolo: "•",
      classe: "text-zinc-400",
      fundo: "border-white/[0.07] bg-white/[0.03]",
    };
  };

  const comparacaoFaturamento = obterComparacaoPeriodo(
    variacaoFaturamento7Dias,
  );

  const comparacaoPedidos = obterComparacaoPeriodo(variacaoPedidos7Dias);

  const comparacaoTicketMedio = obterComparacaoPeriodo(
    variacaoTicketMedio7Dias,
  );

  // -----------------------------------------
  // INTELIGÊNCIA FINANCEIRA MENSAL
  // -----------------------------------------

  const pedidosValidosMesAtual = pedidosMesAtual.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const pedidosValidosMesAnterior = pedidosMesAnterior.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const quantidadePedidosMesAtual = pedidosValidosMesAtual.length;

  const faturamentoMesAtual = pedidosValidosMesAtual.reduce(
    (total, pedido) => total + Number(pedido.total),
    0,
  );

  const ticketMedioMesAtual =
    quantidadePedidosMesAtual > 0
      ? faturamentoMesAtual / quantidadePedidosMesAtual
      : 0;

  // Mesmo intervalo de tempo do mês atual aplicado ao mês anterior.
  // Ex.: 01/09 até 14/09 16h compara com 01/08 até 14/08 16h.
  const agora = new Date();

  const tempoDecorridoMesAtual = Math.max(
    0,
    agora.getTime() - inicioMesAtual.getTime(),
  );

  const fimPeriodoComparavelMesAnterior = new Date(
    Math.min(
      inicioMesAnterior.getTime() + tempoDecorridoMesAtual,
      inicioMesAtual.getTime(),
    ),
  );

  const pedidosPeriodoComparavelMesAnterior = pedidosValidosMesAnterior.filter(
    (pedido) => {
      const dataPedido = new Date(pedido.created_at);

      return dataPedido < fimPeriodoComparavelMesAnterior;
    },
  );

  const quantidadePedidosPeriodoComparavelMesAnterior =
    pedidosPeriodoComparavelMesAnterior.length;

  const faturamentoPeriodoComparavelMesAnterior =
    pedidosPeriodoComparavelMesAnterior.reduce(
      (total, pedido) => total + Number(pedido.total),
      0,
    );

  const ticketMedioPeriodoComparavelMesAnterior =
    quantidadePedidosPeriodoComparavelMesAnterior > 0
      ? faturamentoPeriodoComparavelMesAnterior /
        quantidadePedidosPeriodoComparavelMesAnterior
      : 0;

  const variacaoFaturamentoMes = calcularVariacaoPercentual(
    faturamentoMesAtual,
    faturamentoPeriodoComparavelMesAnterior,
  );

  const variacaoPedidosMes = calcularVariacaoPercentual(
    quantidadePedidosMesAtual,
    quantidadePedidosPeriodoComparavelMesAnterior,
  );

  const variacaoTicketMedioMes = calcularVariacaoPercentual(
    ticketMedioMesAtual,
    ticketMedioPeriodoComparavelMesAnterior,
  );

  const comparacaoFaturamentoMes = obterComparacaoPeriodo(
    variacaoFaturamentoMes,
  );

  const comparacaoPedidosMes = obterComparacaoPeriodo(variacaoPedidosMes);

  const comparacaoTicketMedioMes = obterComparacaoPeriodo(
    variacaoTicketMedioMes,
  );

  // Projeção de faturamento até o fechamento do mês,
  // usando o ritmo real transcorrido até agora.
  const duracaoTotalMesAtual =
    inicioProximoMes.getTime() - inicioMesAtual.getTime();

  const percentualMesDecorrido =
    duracaoTotalMesAtual > 0
      ? Math.min(Math.max(tempoDecorridoMesAtual / duracaoTotalMesAtual, 0), 1)
      : 0;

  const projecaoFaturamentoMes =
    percentualMesDecorrido > 0
      ? faturamentoMesAtual / percentualMesDecorrido
      : 0;

  const faturamentoMesAnteriorCompleto = pedidosValidosMesAnterior.reduce(
    (total, pedido) => total + Number(pedido.total),
    0,
  );

  const pedidosClientesValidos = pedidosClientes.filter(
    (pedido) => pedido.status !== "cancelado" && pedido.cliente_id !== null,
  );

  const pedidosClientes30Dias = pedidosClientesValidos.filter(
    (pedido) => new Date(pedido.created_at) >= inicioUltimos30Dias,
  );

  const clientesAtivos30Dias = new Set(
    pedidosClientes30Dias.map((pedido) => Number(pedido.cliente_id)),
  );

  const quantidadeClientesAtivos30Dias = clientesAtivos30Dias.size;

  const pedidosPorCliente = new Map<
    number,
    {
      quantidadeTotal: number;
      quantidade30Dias: number;
      faturamento30Dias: number;
      primeiraCompra: Date;
      ultimaCompra: Date;
    }
  >();

  for (const pedido of pedidosClientesValidos) {
    const clienteId = Number(pedido.cliente_id);
    const dataPedido = new Date(pedido.created_at);
    const dentro30Dias = dataPedido >= inicioUltimos30Dias;

    const clienteAtual = pedidosPorCliente.get(clienteId);

    if (clienteAtual) {
      clienteAtual.quantidadeTotal += 1;

      if (dataPedido < clienteAtual.primeiraCompra) {
        clienteAtual.primeiraCompra = dataPedido;
      }

      if (dataPedido > clienteAtual.ultimaCompra) {
        clienteAtual.ultimaCompra = dataPedido;
      }

      if (dentro30Dias) {
        clienteAtual.quantidade30Dias += 1;
        clienteAtual.faturamento30Dias += Number(pedido.total);
      }
    } else {
      pedidosPorCliente.set(clienteId, {
        quantidadeTotal: 1,
        quantidade30Dias: dentro30Dias ? 1 : 0,
        faturamento30Dias: dentro30Dias ? Number(pedido.total) : 0,
        primeiraCompra: dataPedido,
        ultimaCompra: dataPedido,
      });
    }
  }

  const clientesNovos30Dias = Array.from(pedidosPorCliente.values()).filter(
    (cliente) => cliente.primeiraCompra >= inicioUltimos30Dias,
  ).length;

  const clientesRecorrentes30Dias = Array.from(
    pedidosPorCliente.values(),
  ).filter((cliente) => cliente.quantidade30Dias >= 2).length;

  const taxaRecompra30Dias =
    quantidadeClientesAtivos30Dias > 0
      ? (clientesRecorrentes30Dias / quantidadeClientesAtivos30Dias) * 100
      : 0;

  const clienteMaiorFaturamento30Dias =
    Array.from(pedidosPorCliente.entries())
      .filter(([, cliente]) => cliente.faturamento30Dias > 0)
      .sort((a, b) => b[1].faturamento30Dias - a[1].faturamento30Dias)[0] ??
    null;

  const clientesPorId = new Map(
    clientesCadastro.map((cliente) => [Number(cliente.id), cliente]),
  );

  const melhorCliente30Dias = clienteMaiorFaturamento30Dias
    ? {
        cadastro: clientesPorId.get(clienteMaiorFaturamento30Dias[0]) ?? null,
        dados: clienteMaiorFaturamento30Dias[1],
      }
    : null;

  const clientesInativos30Dias = Array.from(pedidosPorCliente.values()).filter(
    (cliente) => cliente.ultimaCompra < inicioUltimos30Dias,
  ).length;

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
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* LUZES DE FUNDO */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-48 -top-48 h-[430px] w-[430px] rounded-full bg-amber-400/[0.045] blur-[150px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-56 -right-52 h-[520px] w-[520px] rounded-full bg-orange-600/[0.035] blur-[160px]"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <AdminNavigation />
        <AdminAutoRefresh ultimoPedidoId={ultimoPedidoId} />

        {/* CABEÇALHO */}
        <section className="animate-slide-up mt-5 overflow-hidden rounded-[30px] border border-white/[0.06] bg-white/[0.025] p-5 shadow-[0_25px_80px_rgba(0,0,0,0.25)] sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Central de gestão
                </p>
              </div>

              <h1 className="text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
                Visão geral da
                <span className="brand-gradient-text"> operação.</span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                Acompanhe pedidos, vendas, pagamentos e estoque do Depósito do
                Zé em um só lugar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.055] px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-400">
                  Sistema online
                </span>
              </div>

              <div className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500">
                  Atualização automática
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* INDICADORES */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* PEDIDOS DE HOJE */}
          <div className="group animate-slide-up delay-1 relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-white/[0.13] hover:bg-white/[0.05] hover:shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/[0.04] blur-3xl transition duration-500 group-hover:bg-white/[0.07]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20 text-xl transition duration-300 group-hover:scale-110">
                  📦
                </div>

                <span className="rounded-full border border-white/[0.06] bg-white/[0.035] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                  Hoje
                </span>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">
                Pedidos recebidos
              </p>

              <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                {quantidadePedidosHoje}
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                pedidos registrados hoje
              </p>
            </div>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-all duration-700 group-hover:w-full" />
          </div>

          {/* FATURAMENTO */}
          <div className="group animate-slide-up delay-2 relative overflow-hidden rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.045] p-5 transition duration-500 hover:-translate-y-1 hover:border-emerald-400/30 hover:shadow-[0_22px_65px_rgba(16,185,129,0.08)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/[0.08] blur-3xl transition duration-500 group-hover:bg-emerald-400/[0.13]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] text-xl transition duration-300 group-hover:scale-110 group-hover:rotate-3">
                  💰
                </div>

                <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Receita
                </span>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-emerald-400/70">
                Faturamento de hoje
              </p>

              <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                {formatarPreco(faturamentoHoje)}
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                cancelamentos desconsiderados
              </p>
            </div>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent transition-all duration-700 group-hover:w-full" />
          </div>

          {/* TICKET MÉDIO */}
          <div className="group animate-slide-up delay-3 relative overflow-hidden rounded-[24px] border border-cyan-400/15 bg-cyan-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_22px_65px_rgba(34,211,238,0.07)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-cyan-400/[0.07] blur-3xl transition duration-500 group-hover:bg-cyan-400/[0.12]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.07] text-xl transition duration-300 group-hover:scale-110 group-hover:-rotate-3">
                  📈
                </div>

                <span className="rounded-full border border-cyan-400/10 bg-cyan-400/[0.05] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-cyan-400">
                  Média
                </span>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-cyan-400/70">
                Ticket médio
              </p>

              <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                {formatarPreco(ticketMedioHoje)}
              </p>

              <p className="mt-2 text-xs text-zinc-600">
                valor médio dos pedidos de hoje
              </p>
            </div>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent transition-all duration-700 group-hover:w-full" />
          </div>

          {/* NOVOS PEDIDOS */}
          <Link
            href="/admin/pedidos?status=recebido"
            className="group animate-slide-up delay-2 relative overflow-hidden rounded-[24px] border border-amber-400/20 bg-amber-400/[0.055] p-5 transition duration-500 hover:-translate-y-1 hover:border-amber-400/45 hover:shadow-[0_22px_70px_rgba(245,158,11,0.11)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/[0.1] blur-3xl transition duration-500 group-hover:bg-amber-400/[0.17]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.09] text-xl transition duration-300 group-hover:scale-110">
                  🔔
                  {quantidadeRecebidos > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-zinc-950 bg-amber-400" />
                    </span>
                  )}
                </div>

                {quantidadeRecebidos > 0 && (
                  <span className="animate-pulse-glow rounded-full bg-amber-400 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-950">
                    Atenção
                  </span>
                )}
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-amber-400">
                Novos pedidos
              </p>

              <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                {quantidadeRecebidos}
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">aguardando atendimento</p>

                <span className="text-sm font-black text-amber-400 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-gradient-to-r from-transparent via-amber-400 to-transparent transition-all duration-700 group-hover:w-full" />
          </Link>

          {/* EM ANDAMENTO */}
          <Link
            href="/admin/pedidos"
            className="group animate-slide-up delay-3 relative overflow-hidden rounded-[24px] border border-blue-400/20 bg-blue-400/[0.045] p-5 transition duration-500 hover:-translate-y-1 hover:border-blue-400/40 hover:shadow-[0_22px_70px_rgba(59,130,246,0.09)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-400/[0.08] blur-3xl transition duration-500 group-hover:bg-blue-400/[0.14]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-400/[0.07] text-xl transition duration-300 group-hover:scale-110 group-hover:translate-x-1">
                  🚚
                </div>

                <span className="rounded-full border border-blue-400/10 bg-blue-400/[0.055] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.11em] text-blue-400">
                  Operação
                </span>
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-blue-400">
                Em andamento
              </p>

              <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                {quantidadeEmAndamento}
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">preparação ou entrega</p>

                <span className="text-sm font-black text-blue-400 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-transparent via-blue-400/70 to-transparent transition-all duration-700 group-hover:w-full" />
          </Link>

          {/* PIX PENDENTE */}
          <Link
            href="/admin/pedidos?pagamento=pix_pendente"
            className="group animate-slide-up delay-4 relative overflow-hidden rounded-[24px] border border-purple-400/20 bg-purple-400/[0.05] p-5 transition duration-500 hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-[0_22px_70px_rgba(168,85,247,0.1)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-purple-400/[0.09] blur-3xl transition duration-500 group-hover:bg-purple-400/[0.15]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-400/15 bg-purple-400/[0.08] text-xl transition duration-300 group-hover:scale-110">
                  ◆
                  {quantidadePixPendentes > 0 && (
                    <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full border-2 border-zinc-950 bg-purple-400" />
                  )}
                </div>

                {quantidadePixPendentes > 0 && (
                  <span className="rounded-full border border-purple-400/15 bg-purple-400/[0.08] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-purple-300">
                    Pendente
                  </span>
                )}
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.13em] text-purple-400">
                PIX pendente
              </p>

              <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                {quantidadePixPendentes}
              </p>

              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">aguardando confirmação</p>

                <span className="text-sm font-black text-purple-400 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-gradient-to-r from-transparent via-purple-400/70 to-transparent transition-all duration-700 group-hover:w-full" />
          </Link>
        </div>

        {/* DESEMPENHO DOS ÚLTIMOS 7 DIAS */}

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-7">
          {/* GLOWS DE FUNDO */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-amber-400/[0.045] blur-[120px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 -right-28 h-80 w-80 rounded-full bg-orange-500/[0.035] blur-[130px]"
          />

          {/* GRID DECORATIVO */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />

          {/* CABEÇALHO */}
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Inteligência comercial
                </p>

                <div className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />

                <span className="hidden text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700 sm:block">
                  Performance
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                <h2 className="text-3xl font-black tracking-[-0.045em] text-white">
                  Últimos <span className="brand-gradient-text">7 dias.</span>
                </h2>

                <div className="mb-1 hidden items-center gap-1.5 rounded-full border border-amber-400/10 bg-amber-400/[0.05] px-2.5 py-1 sm:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

                  <span className="text-[7px] font-black uppercase tracking-[0.1em] text-amber-400">
                    Período ativo
                  </span>
                </div>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                Visão consolidada de faturamento, pedidos, ticket médio,
                produtos e comportamento da operação.
              </p>
            </div>

            {/* STATUS DA ANÁLISE */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-emerald-400">
                  Dados atualizados
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                <span className="text-xs">📅</span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">
                  Janela de 7 dias
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-red-400/10 bg-red-400/[0.025] px-3 py-2">
                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                  Cancelados excluídos
                </span>
              </div>
            </div>
          </div>

          {/* DIVISOR */}
          <div className="relative mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-linear-to-r from-amber-400/20 via-white/[0.05] to-transparent" />

            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-zinc-800">
              resumo executivo
            </span>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {/* FATURAMENTO */}
            <div className="group relative overflow-hidden rounded-[22px] border border-emerald-400/15 bg-emerald-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-emerald-400/30 hover:shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/[0.08] blur-3xl transition duration-500 group-hover:bg-emerald-400/[0.14]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] text-xl transition duration-300 group-hover:scale-110 group-hover:rotate-3">
                    💰
                  </div>

                  <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.06] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-400">
                    Receita
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-400/70">
                  Faturamento
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                  {formatarPreco(faturamentoUltimos7Dias)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black ${comparacaoFaturamento.fundo} ${comparacaoFaturamento.classe}`}
                  >
                    {comparacaoFaturamento.simbolo}{" "}
                    {comparacaoFaturamento.texto}
                  </span>

                  <span className="text-[8px] text-zinc-600">
                    vs. 7 dias anteriores
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-emerald-400 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>

            {/* PEDIDOS */}
            <div className="group relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-white/[0.025] p-5 transition duration-500 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.04] hover:shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/[0.04] blur-3xl transition duration-500 group-hover:bg-white/[0.07]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20 text-xl transition duration-300 group-hover:scale-110">
                    📦
                  </div>

                  <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-zinc-600">
                    Volume
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  Pedidos
                </p>

                <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                  {quantidadePedidosUltimos7Dias}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black ${comparacaoPedidos.fundo} ${comparacaoPedidos.classe}`}
                  >
                    {comparacaoPedidos.simbolo} {comparacaoPedidos.texto}
                  </span>

                  <span className="text-[8px] text-zinc-600">
                    vs. 7 dias anteriores
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-white/40 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>

            {/* TICKET MÉDIO */}
            <div className="group relative overflow-hidden rounded-[22px] border border-cyan-400/15 bg-cyan-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_20px_60px_rgba(34,211,238,0.07)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-cyan-400/[0.07] blur-3xl transition duration-500 group-hover:bg-cyan-400/[0.12]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.07] text-xl transition duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    📈
                  </div>

                  <span className="rounded-full border border-cyan-400/10 bg-cyan-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-cyan-400">
                    Média
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-400/70">
                  Ticket médio
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                  {formatarPreco(ticketMedioUltimos7Dias)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black ${comparacaoTicketMedio.fundo} ${comparacaoTicketMedio.classe}`}
                  >
                    {comparacaoTicketMedio.simbolo}{" "}
                    {comparacaoTicketMedio.texto}
                  </span>

                  <span className="text-[8px] text-zinc-600">
                    vs. 7 dias anteriores
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-cyan-400 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>

            {/* CAMPEÃO DE VENDAS */}
            <div className="group relative overflow-hidden rounded-[22px] border border-amber-400/20 bg-amber-400/[0.05] p-5 transition duration-500 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_20px_65px_rgba(245,158,11,0.1)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/[0.1] blur-3xl transition duration-500 group-hover:bg-amber-400/[0.16]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.09] text-xl transition duration-300 group-hover:scale-110 group-hover:rotate-6">
                    🏆
                  </div>

                  <span className="rounded-full bg-amber-400 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-zinc-950">
                    Campeão
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-400">
                  Mais vendido
                </p>

                {produtoMaisVendidoUltimos7Dias ? (
                  <>
                    <p className="mt-1 truncate text-lg font-black tracking-[-0.025em] text-white">
                      {produtoMaisVendidoUltimos7Dias.nome}
                    </p>

                    <p className="mt-2 text-[9px] text-zinc-600">
                      {produtoMaisVendidoUltimos7Dias.quantidade}{" "}
                      {produtoMaisVendidoUltimos7Dias.quantidade === 1
                        ? "unidade vendida"
                        : "unidades vendidas"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-lg font-black text-zinc-500">
                      Sem vendas
                    </p>

                    <p className="mt-2 text-[9px] text-zinc-700">
                      nenhuma venda registrada
                    </p>
                  </>
                )}
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-amber-400 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>

            {/* CANCELAMENTOS */}
            <div
              className={`group relative overflow-hidden rounded-[22px] border p-5 transition duration-500 hover:-translate-y-1 ${
                taxaCancelamento7Dias > 0
                  ? "border-red-400/15 bg-red-400/[0.035] hover:border-red-400/30 hover:shadow-[0_20px_60px_rgba(248,113,113,0.07)]"
                  : "border-emerald-400/10 bg-emerald-400/[0.025] hover:border-emerald-400/20"
              }`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl transition duration-500 ${
                  taxaCancelamento7Dias > 0
                    ? "bg-red-400/[0.07] group-hover:bg-red-400/[0.12]"
                    : "bg-emerald-400/[0.05] group-hover:bg-emerald-400/[0.09]"
                }`}
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border text-xl transition duration-300 group-hover:scale-110 ${
                      taxaCancelamento7Dias > 0
                        ? "border-red-400/15 bg-red-400/[0.07]"
                        : "border-emerald-400/15 bg-emerald-400/[0.06]"
                    }`}
                  >
                    {taxaCancelamento7Dias > 0 ? "🚫" : "✓"}
                  </div>

                  <span
                    className={`rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${
                      taxaCancelamento7Dias > 0
                        ? "border-red-400/10 bg-red-400/[0.05] text-red-400"
                        : "border-emerald-400/10 bg-emerald-400/[0.05] text-emerald-400"
                    }`}
                  >
                    {taxaCancelamento7Dias > 0 ? "Atenção" : "Excelente"}
                  </span>
                </div>

                <p
                  className={`mt-5 text-[9px] font-black uppercase tracking-[0.12em] ${
                    taxaCancelamento7Dias > 0
                      ? "text-red-400/80"
                      : "text-emerald-400/80"
                  }`}
                >
                  Cancelamentos
                </p>

                <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                  {taxaCancelamento7Dias.toFixed(1)}%
                </p>

                <p className="mt-2 text-[9px] text-zinc-600">
                  {quantidadeCancelados7Dias}{" "}
                  {quantidadeCancelados7Dias === 1 ? "cancelado" : "cancelados"}{" "}
                  de {quantidadeTotalPedidos7Dias}
                </p>
              </div>

              <div
                className={`absolute bottom-0 left-0 h-px w-0 transition-all duration-700 group-hover:w-full ${
                  taxaCancelamento7Dias > 0
                    ? "bg-linear-to-r from-transparent via-red-400 to-transparent"
                    : "bg-linear-to-r from-transparent via-emerald-400 to-transparent"
                }`}
              />
            </div>
          </div>

          <div className="group/chart relative mt-8 overflow-hidden rounded-[26px] border border-white/[0.07] bg-zinc-950/80 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
            {/* ANIMAÇÃO LOCAL DAS BARRAS */}
            <style>
              {`
      @keyframes admin-bar-grow {
        0% {
          transform: scaleY(0);
          opacity: 0;
        }

        65% {
          opacity: 1;
        }

        100% {
          transform: scaleY(1);
          opacity: 1;
        }
      }
    `}
            </style>

            {/* GLOW */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-400/[0.06] blur-[100px] transition duration-700 group-hover/chart:bg-amber-400/[0.1]"
            />

            {/* CABEÇALHO */}
            <div className="relative flex items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-px w-6 bg-amber-400" />

                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-400">
                    Faturamento diário
                  </p>
                </div>

                <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-white">
                  Evolução dos últimos 7 dias
                </h3>

                <p className="mt-1 text-xs text-zinc-600">
                  Passe o mouse sobre as barras para ver os detalhes.
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2 lg:flex">
                <span className="h-2 w-2 rounded-full bg-amber-400" />

                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  Receita
                </span>
              </div>
            </div>

            {/* GRÁFICO */}
            <div className="relative mt-8">
              {/* LINHAS HORIZONTAIS */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 flex h-52 flex-col justify-between"
              >
                {[1, 2, 3, 4, 5].map((linha) => (
                  <div
                    key={linha}
                    className="border-t border-dashed border-white/[0.045]"
                  />
                ))}
              </div>

              <div className="relative flex h-64 items-end gap-3 xl:gap-5">
                {dadosUltimos7Dias.map((dia, indice) => {
                  const percentual =
                    dia.faturamento > 0
                      ? Math.max(
                          (dia.faturamento / maiorFaturamento7Dias) * 100,
                          6,
                        )
                      : 2;

                  const melhorDia =
                    dia.faturamento > 0 &&
                    dia.faturamento === maiorFaturamento7Dias;

                  return (
                    <div
                      key={dia.data}
                      className="group flex h-full min-w-0 flex-1 flex-col justify-end"
                    >
                      {/* ÁREA DA BARRA */}
                      <div className="relative flex h-52 items-end justify-center">
                        {/* TOOLTIP */}
                        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-max -translate-x-1/2 translate-y-2 scale-95 rounded-xl border border-white/[0.08] bg-zinc-900 px-3 py-2 opacity-0 shadow-[0_15px_40px_rgba(0,0,0,0.45)] transition duration-300 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
                          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500">
                            {dia.label}
                          </p>

                          <p className="mt-1 text-xs font-black text-amber-400">
                            {formatarPreco(dia.faturamento)}
                          </p>

                          <p className="mt-0.5 text-[9px] text-zinc-600">
                            {dia.quantidadePedidos}{" "}
                            {dia.quantidadePedidos === 1 ? "pedido" : "pedidos"}
                          </p>
                        </div>

                        {/* VALOR ACIMA */}
                        <div className="absolute left-1/2 top-0 -translate-x-1/2 transition duration-300 group-hover:-translate-y-1">
                          <p
                            className={`whitespace-nowrap text-center text-[9px] font-black xl:text-[10px] ${
                              melhorDia ? "text-amber-400" : "text-zinc-500"
                            }`}
                          >
                            {formatarPreco(dia.faturamento)}
                          </p>

                          {melhorDia && (
                            <div className="mt-1 flex justify-center">
                              <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.1em] text-amber-400">
                                Pico
                              </span>
                            </div>
                          )}
                        </div>

                        {/* BARRA ANIMADA */}
                        <div
                          className="relative w-full max-w-[72px] origin-bottom"
                          style={{
                            height: `${percentual}%`,
                            animation:
                              "admin-bar-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) both",
                            animationDelay: `${150 + indice * 100}ms`,
                          }}
                        >
                          {/* GLOW DA BARRA */}
                          <div className="absolute inset-x-1 bottom-0 top-2 rounded-t-xl bg-amber-400/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />

                          {/* BARRA */}
                          <div
                            className={`relative h-full w-full overflow-hidden rounded-t-[14px] border transition duration-500 group-hover:-translate-y-1 group-hover:scale-x-[1.04] ${
                              melhorDia
                                ? "border-amber-300/30 bg-linear-to-t from-amber-600 via-amber-400 to-yellow-200 shadow-[0_0_35px_rgba(251,191,36,0.18)]"
                                : "border-amber-400/15 bg-linear-to-t from-amber-700/80 via-amber-500 to-amber-300"
                            }`}
                          >
                            {/* BRILHO INTERNO */}
                            <div className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-white/20 to-transparent opacity-60" />

                            <div className="absolute -left-full top-0 h-full w-1/2 skew-x-[-20deg] bg-white/10 transition-all duration-700 group-hover:left-[130%]" />
                          </div>
                        </div>
                      </div>

                      {/* DATA */}
                      <div className="mt-4 text-center">
                        <p
                          className={`text-[10px] font-black transition duration-300 group-hover:text-amber-400 ${
                            melhorDia ? "text-amber-400" : "text-zinc-500"
                          }`}
                        >
                          {dia.label}
                        </p>

                        <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                          {dia.quantidadePedidos}{" "}
                          {dia.quantidadePedidos === 1 ? "pedido" : "pedidos"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RODAPÉ DO GRÁFICO */}
            <div className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4">
              <p className="text-[9px] text-zinc-700">
                Pedidos cancelados não entram no cálculo.
              </p>

              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-700">
                  Total
                </span>

                <span className="text-xs font-black text-emerald-400">
                  {formatarPreco(faturamentoUltimos7Dias)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {dadosUltimos7Dias.map((dia, indice) => {
              const possuiVenda = dia.faturamento > 0;

              const melhorDia =
                possuiVenda && dia.faturamento === maiorFaturamento7Dias;

              return (
                <div
                  key={dia.data}
                  className={`group relative overflow-hidden rounded-[18px] border p-4 transition duration-500 hover:-translate-y-1 ${
                    melhorDia
                      ? "border-amber-400/30 bg-amber-400/[0.07] shadow-[0_15px_45px_rgba(245,158,11,0.08)]"
                      : possuiVenda
                        ? "border-white/[0.07] bg-white/[0.03] hover:border-amber-400/20 hover:bg-white/[0.045]"
                        : "border-white/[0.05] bg-black/20 opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    animationDelay: `${indice * 70}ms`,
                  }}
                >
                  {/* GLOW */}
                  {possuiVenda && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-amber-400/[0.06] blur-2xl opacity-0 transition duration-500 group-hover:opacity-100"
                    />
                  )}

                  <div className="relative">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-[10px] font-black uppercase tracking-[0.1em] ${
                          melhorDia ? "text-amber-400" : "text-zinc-500"
                        }`}
                      >
                        {dia.label}
                      </p>

                      {melhorDia && (
                        <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-wider text-zinc-950">
                          Pico
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-3xl font-black tracking-[-0.05em] text-white transition duration-300 group-hover:text-amber-300">
                      {dia.quantidadePedidos}
                    </p>

                    <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                      {dia.quantidadePedidos === 1 ? "pedido" : "pedidos"}
                    </p>

                    <div className="my-3 h-px bg-white/[0.05]" />

                    <p
                      className={`text-xs font-black ${
                        possuiVenda ? "text-emerald-400" : "text-zinc-700"
                      }`}
                    >
                      {formatarPreco(dia.faturamento)}
                    </p>

                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className={`h-full origin-left rounded-full transition-all duration-700 ${
                          melhorDia
                            ? "bg-amber-400"
                            : possuiVenda
                              ? "bg-emerald-400/70"
                              : "bg-zinc-800"
                        }`}
                        style={{
                          width: possuiVenda
                            ? `${Math.max(
                                (dia.faturamento / maiorFaturamento7Dias) * 100,
                                8,
                              )}%`
                            : "4%",
                        }}
                      />
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-amber-400/60 to-transparent transition-all duration-700 group-hover:w-full" />
                </div>
              );
            })}
          </div>
        </section>

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)]">
          {/* GLOW DE FUNDO */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-amber-400/[0.055] blur-[110px]"
          />

          {/* CABEÇALHO */}
          <div className="relative flex items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Ranking de vendas
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Produtos mais vendidos
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Top 5 dos últimos 7 dias, desconsiderando pedidos cancelados.
              </p>
            </div>

            {rankingProdutosUltimos7Dias.length > 0 && (
              <div className="hidden rounded-full border border-amber-400/10 bg-amber-400/[0.055] px-3 py-2 lg:block">
                <span className="text-[8px] font-black uppercase tracking-[0.12em] text-amber-400">
                  🏆 TOP 5
                </span>
              </div>
            )}
          </div>

          {rankingProdutosUltimos7Dias.length === 0 ? (
            <div className="mt-6 rounded-[22px] border border-white/[0.06] bg-black/20 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.035] text-xl">
                📊
              </div>

              <p className="mt-4 font-black text-zinc-400">
                Nenhuma venda registrada
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                O ranking aparecerá assim que houver vendas no período.
              </p>
            </div>
          ) : (
            <div className="relative mt-7 space-y-3">
              {rankingProdutosUltimos7Dias.map((produto, indice) => {
                const maiorQuantidade =
                  rankingProdutosUltimos7Dias[0]?.quantidade ?? 1;

                const percentualRanking = Math.max(
                  (produto.quantidade / maiorQuantidade) * 100,
                  8,
                );

                const medalha =
                  indice === 0
                    ? "🥇"
                    : indice === 1
                      ? "🥈"
                      : indice === 2
                        ? "🥉"
                        : `${indice + 1}º`;

                const primeiroLugar = indice === 0;
                const segundoLugar = indice === 1;
                const terceiroLugar = indice === 2;

                return (
                  <div
                    key={produto.nome}
                    className={`group relative overflow-hidden rounded-[22px] border p-4 transition duration-500 hover:-translate-y-1 ${
                      primeiroLugar
                        ? "border-amber-400/30 bg-amber-400/[0.065] shadow-[0_20px_60px_rgba(245,158,11,0.08)]"
                        : segundoLugar
                          ? "border-zinc-400/15 bg-zinc-400/[0.035]"
                          : terceiroLugar
                            ? "border-orange-400/15 bg-orange-400/[0.035]"
                            : "border-white/[0.06] bg-black/20 hover:border-white/[0.12] hover:bg-white/[0.035]"
                    }`}
                    style={{
                      animationDelay: `${indice * 90}ms`,
                    }}
                  >
                    {/* GLOW */}
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl opacity-0 transition duration-500 group-hover:opacity-100 ${
                        primeiroLugar
                          ? "bg-amber-400/15"
                          : segundoLugar
                            ? "bg-zinc-300/10"
                            : terceiroLugar
                              ? "bg-orange-400/10"
                              : "bg-white/[0.05]"
                      }`}
                    />

                    <div className="relative flex items-center gap-4">
                      {/* POSIÇÃO */}
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] border text-xl font-black transition duration-500 group-hover:scale-110 group-hover:-rotate-3 ${
                          primeiroLugar
                            ? "border-amber-400/30 bg-amber-400 text-zinc-950 shadow-[0_0_30px_rgba(245,158,11,0.18)]"
                            : segundoLugar
                              ? "border-zinc-300/20 bg-zinc-300/10 text-zinc-200"
                              : terceiroLugar
                                ? "border-orange-400/20 bg-orange-400/10 text-orange-300"
                                : "border-white/[0.07] bg-white/[0.035] text-zinc-500"
                        }`}
                      >
                        {medalha}
                      </div>

                      {/* PRODUTO */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className={`truncate font-black transition duration-300 ${
                                  primeiroLugar
                                    ? "text-amber-200"
                                    : "text-white"
                                }`}
                              >
                                {produto.nome}
                              </p>

                              {primeiroLugar && (
                                <span className="shrink-0 rounded-full bg-amber-400 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-zinc-950">
                                  Campeão
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-600">
                              {indice + 1}ª posição
                            </p>
                          </div>

                          {/* QUANTIDADE */}
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-2xl font-black tracking-[-0.04em] ${
                                primeiroLugar
                                  ? "text-amber-400"
                                  : "text-zinc-300"
                              }`}
                            >
                              {produto.quantidade}
                            </p>

                            <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                              {produto.quantidade === 1
                                ? "unidade"
                                : "unidades"}
                            </p>
                          </div>
                        </div>

                        {/* BARRA */}
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.045]">
                          <div
                            className={`relative h-full origin-left overflow-hidden rounded-full transition-all duration-700 group-hover:brightness-125 ${
                              primeiroLugar
                                ? "bg-linear-to-r from-amber-600 via-amber-400 to-yellow-200"
                                : segundoLugar
                                  ? "bg-linear-to-r from-zinc-600 to-zinc-300"
                                  : terceiroLugar
                                    ? "bg-linear-to-r from-orange-700 to-orange-400"
                                    : "bg-linear-to-r from-zinc-800 to-zinc-500"
                            }`}
                            style={{
                              width: `${percentualRanking}%`,
                            }}
                          >
                            <div className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover:left-[120%]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* LINHA INFERIOR */}
                    <div
                      className={`absolute bottom-0 left-0 h-px w-0 transition-all duration-700 group-hover:w-full ${
                        primeiroLugar
                          ? "bg-linear-to-r from-transparent via-amber-400 to-transparent"
                          : "bg-linear-to-r from-transparent via-white/30 to-transparent"
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* RODAPÉ */}
          {rankingProdutosUltimos7Dias.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4">
              <p className="text-[9px] text-zinc-700">
                Ranking calculado pela quantidade vendida.
              </p>

              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                Últimos 7 dias
              </span>
            </div>
          )}
        </section>

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)]">
          {/* ANIMAÇÃO DAS BARRAS */}
          <style>
            {`
      @keyframes payment-bar-grow {
        from {
          transform: scaleX(0);
          opacity: 0;
        }

        to {
          transform: scaleX(1);
          opacity: 1;
        }
      }
    `}
          </style>

          {/* GLOWS */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-purple-500/[0.045] blur-[110px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-blue-500/[0.04] blur-[110px]"
          />

          {/* CABEÇALHO */}
          <div className="relative flex items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Pagamentos
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Formas de pagamento
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Distribuição dos pedidos válidos nos últimos 7 dias.
              </p>
            </div>

            <div className="hidden rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2 lg:block">
              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                {totalPagamentos7Dias} pagamentos
              </span>
            </div>
          </div>

          {/* CARDS */}
          <div className="relative mt-7 grid gap-4 lg:grid-cols-3">
            {/* PIX */}
            <div className="group relative overflow-hidden rounded-[24px] border border-purple-400/15 bg-purple-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-purple-400/35 hover:shadow-[0_20px_60px_rgba(168,85,247,0.08)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-purple-400/[0.08] blur-3xl opacity-70 transition duration-500 group-hover:bg-purple-400/[0.15]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-purple-400/20 bg-purple-400/[0.08] text-xl transition duration-300 group-hover:scale-110 group-hover:rotate-3">
                    ◆
                  </div>

                  <span className="rounded-full border border-purple-400/15 bg-purple-400/[0.07] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-purple-300">
                    PIX
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-purple-400/70">
                      Participação
                    </p>

                    <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                      {percentualPix7Dias.toFixed(0)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-purple-300">
                      {quantidadePix7Dias}
                    </p>

                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                      {quantidadePix7Dias === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.045]">
                  <div
                    className="relative h-full origin-left rounded-full bg-linear-to-r from-purple-700 via-purple-500 to-fuchsia-300"
                    style={{
                      width: `${percentualPix7Dias}%`,
                      animation:
                        "payment-bar-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) 150ms both",
                    }}
                  >
                    <div className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover:left-[120%]" />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-700">
                    Faturamento
                  </span>

                  <span className="text-sm font-black text-purple-300">
                    {formatarPreco(faturamentoPix7Dias)}
                  </span>
                </div>
              </div>
            </div>

            {/* DINHEIRO */}
            <div className="group relative overflow-hidden rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-emerald-400/35 hover:shadow-[0_20px_60px_rgba(16,185,129,0.08)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/[0.08] blur-3xl opacity-70 transition duration-500 group-hover:bg-emerald-400/[0.15]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-emerald-400/20 bg-emerald-400/[0.08] text-xl transition duration-300 group-hover:scale-110 group-hover:-rotate-3">
                    💵
                  </div>

                  <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-emerald-300">
                    Dinheiro
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-400/70">
                      Participação
                    </p>

                    <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                      {percentualDinheiro7Dias.toFixed(0)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-300">
                      {quantidadeDinheiro7Dias}
                    </p>

                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                      {quantidadeDinheiro7Dias === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.045]">
                  <div
                    className="relative h-full origin-left rounded-full bg-linear-to-r from-emerald-700 via-emerald-500 to-green-300"
                    style={{
                      width: `${percentualDinheiro7Dias}%`,
                      animation:
                        "payment-bar-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) 260ms both",
                    }}
                  >
                    <div className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover:left-[120%]" />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-700">
                    Faturamento
                  </span>

                  <span className="text-sm font-black text-emerald-300">
                    {formatarPreco(faturamentoDinheiro7Dias)}
                  </span>
                </div>
              </div>
            </div>

            {/* CARTÃO */}
            <div className="group relative overflow-hidden rounded-[24px] border border-blue-400/15 bg-blue-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-blue-400/35 hover:shadow-[0_20px_60px_rgba(59,130,246,0.08)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-blue-400/[0.08] blur-3xl opacity-70 transition duration-500 group-hover:bg-blue-400/[0.15]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-blue-400/20 bg-blue-400/[0.08] text-xl transition duration-300 group-hover:scale-110 group-hover:rotate-3">
                    💳
                  </div>

                  <span className="rounded-full border border-blue-400/15 bg-blue-400/[0.07] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-blue-300">
                    Cartão
                  </span>
                </div>

                <div className="mt-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-blue-400/70">
                      Participação
                    </p>

                    <p className="mt-1 text-4xl font-black tracking-[-0.05em] text-white">
                      {percentualCartao7Dias.toFixed(0)}%
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-blue-300">
                      {quantidadeCartao7Dias}
                    </p>

                    <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                      {quantidadeCartao7Dias === 1 ? "pedido" : "pedidos"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.045]">
                  <div
                    className="relative h-full origin-left rounded-full bg-linear-to-r from-blue-700 via-blue-500 to-cyan-300"
                    style={{
                      width: `${percentualCartao7Dias}%`,
                      animation:
                        "payment-bar-grow 900ms cubic-bezier(0.16, 1, 0.3, 1) 370ms both",
                    }}
                  >
                    <div className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/20 transition-all duration-700 group-hover:left-[120%]" />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-4">
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-700">
                    Faturamento
                  </span>

                  <span className="text-sm font-black text-blue-300">
                    {formatarPreco(faturamentoCartao7Dias)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="relative mt-6 flex items-center justify-between border-t border-white/[0.05] pt-4">
            <p className="text-[9px] text-zinc-700">
              Apenas pedidos não cancelados entram nesta análise.
            </p>

            <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
              Últimos 7 dias
            </span>
          </div>
        </section>

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)]">
          {/* GLOWS */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-400/[0.045] blur-[110px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-blue-500/[0.045] blur-[110px]"
          />

          {/* CABEÇALHO */}
          <div className="relative flex items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Inteligência da operação
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Horário e região de maior movimento
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Entenda quando e onde seus clientes mais fazem pedidos.
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2 lg:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>

              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-500">
                Últimos 7 dias
              </span>
            </div>
          </div>

          <div className="relative mt-7 grid gap-5 lg:grid-cols-2">
            {/* HORÁRIO DE PICO */}
            <div className="group relative min-h-[245px] overflow-hidden rounded-[26px] border border-amber-400/15 bg-amber-400/[0.04] p-6 transition duration-500 hover:-translate-y-1 hover:border-amber-400/35 hover:shadow-[0_22px_70px_rgba(245,158,11,0.09)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-400/[0.1] blur-3xl transition duration-500 group-hover:bg-amber-400/[0.17]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-amber-400/20 bg-amber-400/[0.09] text-2xl transition duration-500 group-hover:scale-110 group-hover:rotate-6">
                    🔥
                  </div>

                  <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-amber-400">
                    Horário de pico
                  </span>
                </div>

                {horarioPicoUltimos7Dias ? (
                  <>
                    <p className="mt-7 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                      Maior movimento
                    </p>

                    <div className="mt-1 flex items-end gap-3">
                      <p className="text-5xl font-black tracking-[-0.06em] text-white">
                        {String(horarioPicoUltimos7Dias[0]).padStart(2, "0")}
                        <span className="text-amber-400">:00</span>
                      </p>

                      <span className="mb-1 rounded-full bg-amber-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-400">
                        Pico
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-zinc-500">
                      {horarioPicoUltimos7Dias[1]}{" "}
                      {horarioPicoUltimos7Dias[1] === 1
                        ? "pedido nesse horário"
                        : "pedidos nesse horário"}
                    </p>

                    {/* MINI VISUAL */}
                    <div className="mt-6 flex h-8 items-end gap-1">
                      {[30, 45, 38, 62, 48, 78, 100, 72, 52, 35, 24].map(
                        (altura, indice) => (
                          <div
                            key={indice}
                            className={`flex-1 rounded-t-sm transition-all duration-500 group-hover:brightness-125 ${
                              altura === 100
                                ? "bg-amber-400"
                                : "bg-amber-400/20"
                            }`}
                            style={{
                              height: `${altura}%`,
                              transitionDelay: `${indice * 25}ms`,
                            }}
                          />
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <div className="mt-7">
                    <p className="font-black text-zinc-400">
                      Ainda não há dados suficientes
                    </p>

                    <p className="mt-2 text-sm text-zinc-600">
                      O horário de pico aparecerá quando houver pedidos válidos.
                    </p>
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-amber-400 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>

            {/* BAIRRO MAIS FORTE */}
            <div className="group relative min-h-[245px] overflow-hidden rounded-[26px] border border-blue-400/15 bg-blue-400/[0.04] p-6 transition duration-500 hover:-translate-y-1 hover:border-blue-400/35 hover:shadow-[0_22px_70px_rgba(59,130,246,0.09)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-400/[0.09] blur-3xl transition duration-500 group-hover:bg-blue-400/[0.16]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-blue-400/20 bg-blue-400/[0.08] text-2xl transition duration-500 group-hover:scale-110 group-hover:-rotate-6">
                    📍
                  </div>

                  <span className="rounded-full border border-blue-400/15 bg-blue-400/[0.07] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-blue-300">
                    Região destaque
                  </span>
                </div>

                {bairroMaisPedidosUltimos7Dias ? (
                  <>
                    <p className="mt-7 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                      Bairro com mais pedidos
                    </p>

                    <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">
                      {bairroMaisPedidosUltimos7Dias[0]}
                    </p>

                    <p className="mt-3 text-sm text-zinc-500">
                      {bairroMaisPedidosUltimos7Dias[1]}{" "}
                      {bairroMaisPedidosUltimos7Dias[1] === 1
                        ? "pedido no período"
                        : "pedidos no período"}
                    </p>

                    <div className="mt-6 overflow-hidden rounded-2xl border border-blue-400/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600">
                          Concentração
                        </span>

                        <span className="text-xs font-black text-blue-300">
                          #{bairroMaisPedidosUltimos7Dias[1]}
                        </span>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.045]">
                        <div className="h-full w-full origin-left rounded-full bg-linear-to-r from-blue-700 via-blue-500 to-cyan-300 transition duration-700 group-hover:brightness-125" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="mt-7">
                    <p className="font-black text-zinc-400">
                      Ainda não há dados suficientes
                    </p>

                    <p className="mt-2 text-sm text-zinc-600">
                      A região de maior movimento aparecerá conforme os pedidos
                      entrarem.
                    </p>
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-blue-400 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>
          </div>

          <div className="relative mt-6 border-t border-white/[0.05] pt-4">
            <p className="text-[9px] text-zinc-700">
              Análise baseada apenas em pedidos válidos dos últimos 7 dias.
            </p>
          </div>
        </section>

        {/* INTELIGÊNCIA FINANCEIRA MENSAL */}

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-7">
          {/* GLOWS */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-28 -top-32 h-80 w-80 rounded-full bg-emerald-400/[0.04] blur-[120px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 -right-28 h-80 w-80 rounded-full bg-cyan-400/[0.03] blur-[130px]"
          />

          {/* CABEÇALHO */}
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-emerald-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">
                  Inteligência financeira
                </p>

                <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />

                <span className="hidden text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700 sm:block">
                  Visão mensal
                </span>
              </div>

              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">
                Desempenho do{" "}
                <span className="brand-gradient-text">mês atual.</span>
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                Acompanhe a evolução financeira do mês e compare o desempenho
                com o mesmo período do mês anterior.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-emerald-400">
                  Mês em andamento
                </span>
              </div>

              <div className="rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">
                  Cancelados excluídos
                </span>
              </div>
            </div>
          </div>

          {/* DIVISOR */}
          <div className="relative mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-linear-to-r from-emerald-400/20 via-white/[0.05] to-transparent" />

            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-zinc-800">
              desempenho acumulado
            </span>
          </div>

          {/* CARDS */}
          <div className="relative mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* FATURAMENTO */}
            <div className="group relative overflow-hidden rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-emerald-400/30">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/[0.08] blur-3xl"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] text-xl transition duration-300 group-hover:scale-110">
                    💰
                  </div>

                  <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-400">
                    Receita
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-400/70">
                  Faturamento do mês
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                  {formatarPreco(faturamentoMesAtual)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black ${comparacaoFaturamentoMes.fundo} ${comparacaoFaturamentoMes.classe}`}
                  >
                    {comparacaoFaturamentoMes.simbolo}{" "}
                    {comparacaoFaturamentoMes.texto}
                  </span>

                  <span className="text-[8px] text-zinc-600">
                    mesmo período anterior
                  </span>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-emerald-400 to-transparent transition-all duration-700 group-hover:w-full" />
            </div>

            {/* PEDIDOS */}
            <div className="group relative overflow-hidden rounded-[24px] border border-blue-400/15 bg-blue-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-blue-400/30">
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-400/[0.07] text-xl transition duration-300 group-hover:scale-110">
                    📦
                  </div>

                  <span className="rounded-full border border-blue-400/10 bg-blue-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-blue-400">
                    Volume
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-blue-400/70">
                  Pedidos do mês
                </p>

                <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                  {quantidadePedidosMesAtual}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black ${comparacaoPedidosMes.fundo} ${comparacaoPedidosMes.classe}`}
                  >
                    {comparacaoPedidosMes.simbolo} {comparacaoPedidosMes.texto}
                  </span>

                  <span className="text-[8px] text-zinc-600">
                    mesmo período anterior
                  </span>
                </div>
              </div>
            </div>

            {/* TICKET MÉDIO */}
            <div className="group relative overflow-hidden rounded-[24px] border border-cyan-400/15 bg-cyan-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-cyan-400/30">
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.07] text-xl transition duration-300 group-hover:scale-110">
                    📊
                  </div>

                  <span className="rounded-full border border-cyan-400/10 bg-cyan-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-cyan-400">
                    Média
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-400/70">
                  Ticket médio
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                  {formatarPreco(ticketMedioMesAtual)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-1 text-[8px] font-black ${comparacaoTicketMedioMes.fundo} ${comparacaoTicketMedioMes.classe}`}
                  >
                    {comparacaoTicketMedioMes.simbolo}{" "}
                    {comparacaoTicketMedioMes.texto}
                  </span>

                  <span className="text-[8px] text-zinc-600">
                    mesmo período anterior
                  </span>
                </div>
              </div>
            </div>

            {/* PROJEÇÃO */}
            <div className="group relative overflow-hidden rounded-[24px] border border-amber-400/20 bg-amber-400/[0.045] p-5 transition duration-500 hover:-translate-y-1 hover:border-amber-400/35">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-400/[0.09] blur-3xl"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-xl transition duration-300 group-hover:scale-110">
                    🎯
                  </div>

                  <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-amber-400">
                    Projeção
                  </span>
                </div>

                <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-400/80">
                  Fechamento estimado
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
                  {formatarPreco(projecaoFaturamentoMes)}
                </p>

                <p className="mt-3 text-[8px] leading-4 text-zinc-600">
                  projeção simples baseada no ritmo atual de faturamento
                </p>
              </div>
            </div>
          </div>

          {/* COMPARATIVO DO MÊS ANTERIOR */}
          <div className="relative mt-5 overflow-hidden rounded-[26px] border border-white/[0.06] bg-zinc-950/60 p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />

                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Referência histórica
                  </p>
                </div>

                <h3 className="mt-2 text-lg font-black tracking-[-0.025em] text-white">
                  Mês anterior completo
                </h3>

                <p className="mt-1 text-[10px] text-zinc-600">
                  faturamento consolidado, excluindo pedidos cancelados
                </p>
              </div>

              <div className="lg:text-right">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                  Faturamento
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-zinc-200">
                  {formatarPreco(faturamentoMesAnteriorCompleto)}
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-5 border-t border-white/[0.05] pt-4">
            <p className="text-[9px] leading-4 text-zinc-700">
              As variações comparam o mês atual com o mesmo intervalo
              transcorrido do mês anterior. A projeção é apenas uma estimativa
              baseada no ritmo atual.
            </p>
          </div>
        </section>

        {/* INTELIGÊNCIA DE CLIENTES */}

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-500/[0.045] blur-[120px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-40 -right-28 h-80 w-80 rounded-full bg-amber-400/[0.035] blur-[130px]"
          />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-violet-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400">
                  Inteligência de clientes
                </p>

                <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />

                <span className="hidden text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700 sm:block">
                  CRM & BI
                </span>
              </div>

              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">
                Relacionamento em{" "}
                <span className="brand-gradient-text">30 dias.</span>
              </h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                Entenda quem está comprando, quem voltou a comprar e quais
                clientes merecem atenção comercial.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-full border border-violet-400/10 bg-violet-400/[0.05] px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-violet-400">
                  Janela de 30 dias
                </span>
              </div>

              <Link
                href="/admin/clientes"
                className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-400 transition hover:border-amber-400/20 hover:text-amber-400"
              >
                Ver CRM →
              </Link>
            </div>
          </div>

          <div className="relative mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-linear-to-r from-violet-400/20 via-white/[0.05] to-transparent" />

            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-zinc-800">
              comportamento da base
            </span>
          </div>

          <div className="relative mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* CLIENTES ATIVOS */}
            <div className="group rounded-[22px] border border-blue-400/15 bg-blue-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-blue-400/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-400/15 bg-blue-400/[0.07] text-xl transition group-hover:scale-110">
                  👥
                </div>

                <span className="rounded-full border border-blue-400/10 bg-blue-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-blue-400">
                  Ativos
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-blue-400/70">
                Clientes ativos
              </p>

              <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                {quantidadeClientesAtivos30Dias}
              </p>

              <p className="mt-2 text-[9px] text-zinc-600">
                compraram nos últimos 30 dias
              </p>
            </div>

            {/* NOVOS CLIENTES */}
            <div className="group rounded-[22px] border border-emerald-400/15 bg-emerald-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-emerald-400/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.07] text-xl transition group-hover:scale-110">
                  ✨
                </div>

                <span className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-400">
                  Aquisição
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-400/70">
                Novos clientes
              </p>

              <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                {clientesNovos30Dias}
              </p>

              <p className="mt-2 text-[9px] text-zinc-600">
                fizeram a primeira compra no período
              </p>
            </div>

            {/* RECORRENTES */}
            <div className="group rounded-[22px] border border-amber-400/15 bg-amber-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-amber-400/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.07] text-xl transition group-hover:scale-110">
                  🔁
                </div>

                <span className="rounded-full border border-amber-400/10 bg-amber-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-amber-400">
                  Retenção
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-400/70">
                Recorrentes
              </p>

              <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                {clientesRecorrentes30Dias}
              </p>

              <p className="mt-2 text-[9px] text-zinc-600">
                compraram duas ou mais vezes
              </p>
            </div>

            {/* TAXA DE RECOMPRA */}
            <div className="group rounded-[22px] border border-violet-400/15 bg-violet-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-violet-400/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-400/[0.07] text-xl transition group-hover:scale-110">
                  📈
                </div>

                <span className="rounded-full border border-violet-400/10 bg-violet-400/[0.05] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-violet-400">
                  Fidelização
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-400/70">
                Taxa de recompra
              </p>

              <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-white">
                {taxaRecompra30Dias.toFixed(1)}%
              </p>

              <p className="mt-2 text-[9px] text-zinc-600">
                dos clientes ativos voltaram a comprar
              </p>
            </div>
          </div>

          <div className="relative mt-5 grid gap-5 lg:grid-cols-2">
            {/* MELHOR CLIENTE */}
            <div className="group relative overflow-hidden rounded-[26px] border border-amber-400/20 bg-amber-400/[0.045] p-6 transition duration-500 hover:border-amber-400/35">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-amber-400/[0.08] blur-[90px]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-400">
                      🏆 Melhor cliente do período
                    </p>

                    {melhorCliente30Dias ? (
                      <>
                        <p className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
                          {melhorCliente30Dias.cadastro?.nome ??
                            "Cliente sem cadastro"}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {melhorCliente30Dias.dados.quantidade30Dias}{" "}
                          {melhorCliente30Dias.dados.quantidade30Dias === 1
                            ? "pedido"
                            : "pedidos"}{" "}
                          nos últimos 30 dias
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-xl font-black text-zinc-500">
                        Sem vendas no período
                      </p>
                    )}
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.08] text-2xl">
                    👑
                  </div>
                </div>

                {melhorCliente30Dias && (
                  <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-amber-400/10 pt-5">
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                        Faturamento gerado
                      </p>

                      <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-amber-400">
                        {formatarPreco(
                          melhorCliente30Dias.dados.faturamento30Dias,
                        )}
                      </p>
                    </div>

                    {melhorCliente30Dias.cadastro && (
                      <Link
                        href={`/admin/clientes/${melhorCliente30Dias.cadastro.id}`}
                        className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-amber-400 transition hover:bg-amber-400 hover:text-zinc-950"
                      >
                        Ver cliente →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* REATIVAÇÃO */}
            <div className="group relative overflow-hidden rounded-[26px] border border-red-400/15 bg-red-400/[0.03] p-6 transition duration-500 hover:border-red-400/30">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-red-400/[0.06] blur-[90px]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-red-400">
                      😴 Oportunidade de reativação
                    </p>

                    <p className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">
                      {clientesInativos30Dias}
                    </p>

                    <p className="mt-2 max-w-md text-xs leading-5 text-zinc-500">
                      clientes com histórico de compras estão há mais de 30 dias
                      sem realizar um novo pedido.
                    </p>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/15 bg-red-400/[0.07] text-2xl">
                    🎯
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-red-400/10 pt-5">
                  <p className="max-w-sm text-[9px] leading-4 text-zinc-600">
                    Essa base pode ser usada futuramente para campanhas de
                    WhatsApp, cupons e promoções de retorno.
                  </p>

                  <Link
                    href="/admin/clientes"
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-400 transition hover:border-red-400/20 hover:text-red-400"
                  >
                    Abrir clientes →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ESTOQUE + ACESSOS */}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="group/estoque relative overflow-hidden rounded-[30px] border border-red-400/15 bg-red-400/[0.035] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] transition duration-500 hover:border-red-400/25">
            {/* GLOW */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-red-500/[0.07] blur-[100px] transition duration-700 group-hover/estoque:bg-red-500/[0.12]"
            />

            {/* CABEÇALHO */}
            <div className="relative flex items-start justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-red-400/20 bg-red-400/[0.08] text-2xl">
                  ⚠️
                  {produtosEstoqueBaixo.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />

                      <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-zinc-950 bg-red-400" />
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-red-400">
                    Controle de estoque
                  </p>

                  <h2 className="mt-1 text-2xl font-black tracking-[-0.035em] text-white">
                    Estoque baixo
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    Produtos que atingiram ou ficaram abaixo do estoque mínimo.
                  </p>
                </div>
              </div>

              <Link
                href="/admin/estoque"
                className="group/link hidden items-center gap-2 rounded-full border border-red-400/15 bg-red-400/[0.055] px-3 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-red-300 transition hover:border-red-400/30 hover:bg-red-400/[0.09] sm:flex"
              >
                Ver estoque
                <span className="transition-transform duration-300 group-hover/link:translate-x-1">
                  →
                </span>
              </Link>
            </div>

            {/* CONTADOR */}
            <div className="relative mt-6 flex items-center gap-3">
              <div
                className={`flex h-11 min-w-11 items-center justify-center rounded-2xl border px-3 text-lg font-black ${
                  produtosEstoqueBaixo.length > 0
                    ? "border-red-400/20 bg-red-400/[0.08] text-red-400"
                    : "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-400"
                }`}
              >
                {produtosEstoqueBaixo.length}
              </div>

              <div>
                <p className="text-xs font-black text-white">
                  {produtosEstoqueBaixo.length === 1
                    ? "produto exige atenção"
                    : produtosEstoqueBaixo.length > 1
                      ? "produtos exigem atenção"
                      : "estoque saudável"}
                </p>

                <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                  situação atual
                </p>
              </div>
            </div>

            {produtosEstoqueBaixo.length === 0 ? (
              <div className="relative mt-6 flex items-center gap-4 rounded-[22px] border border-emerald-400/15 bg-emerald-400/[0.055] p-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-xl">
                  ✅
                </div>

                <div>
                  <p className="text-sm font-black text-emerald-400">
                    Estoque sob controle
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Nenhum produto está abaixo do estoque mínimo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative mt-6 space-y-3">
                {produtosEstoqueBaixo.slice(0, 6).map((produto, indice) => {
                  const estoqueAtual = Number(produto.estoque);
                  const estoqueMinimo = Number(produto.estoque_minimo);

                  const critico = estoqueAtual === 0;

                  const percentualEstoque =
                    estoqueMinimo > 0
                      ? Math.min(
                          Math.max((estoqueAtual / estoqueMinimo) * 100, 3),
                          100,
                        )
                      : 0;

                  return (
                    <Link
                      key={produto.id}
                      href={`/admin/produtos/${produto.id}`}
                      className={`group/item relative block overflow-hidden rounded-[20px] border p-4 transition duration-500 hover:-translate-y-0.5 ${
                        critico
                          ? "border-red-500/25 bg-red-500/[0.065] hover:border-red-400/45"
                          : "border-white/[0.06] bg-black/20 hover:border-red-400/20 hover:bg-white/[0.03]"
                      }`}
                      style={{
                        animationDelay: `${indice * 70}ms`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-black text-white">
                              {produto.nome}
                            </p>

                            {critico && (
                              <span className="shrink-0 rounded-full bg-red-500 px-2 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-white">
                                Esgotado
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                            Estoque mínimo: {produto.estoque_minimo}
                          </p>

                          {/* BARRA */}
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.045]">
                            <div
                              className={`h-full origin-left rounded-full transition-all duration-700 group-hover/item:brightness-125 ${
                                critico
                                  ? "bg-red-500"
                                  : "bg-linear-to-r from-red-600 to-orange-400"
                              }`}
                              style={{
                                width: `${percentualEstoque}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`text-2xl font-black tracking-[-0.04em] ${
                              critico ? "text-red-400" : "text-orange-400"
                            }`}
                          >
                            {produto.estoque}
                          </p>

                          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
                            unidades
                          </p>
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-red-400 to-transparent transition-all duration-700 group-hover/item:w-full" />
                    </Link>
                  );
                })}
              </div>
            )}

            {/* BOTÃO MOBILE/FALLBACK */}
            <Link
              href="/admin/estoque"
              className="pressable mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500 transition hover:border-red-400/20 hover:text-red-300 sm:hidden"
            >
              Abrir controle de estoque
              <span>→</span>
            </Link>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-red-400/60 to-transparent transition-all duration-700 group-hover/estoque:w-full" />
          </section>

          <section className="group/atalhos relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] transition duration-500 hover:border-amber-400/15">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/[0.05] blur-[110px] transition duration-700 group-hover/atalhos:bg-amber-400/[0.09]"
            />

            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Central de acesso
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Acessos rápidos
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Vá direto para as áreas mais usadas da operação.
              </p>
            </div>

            <div className="relative mt-7 grid gap-3 sm:grid-cols-2">
              <Link
                href="/admin/pedidos"
                className="group/item relative overflow-hidden rounded-[22px] border border-amber-400/15 bg-amber-400/[0.04] p-5 transition duration-500 hover:-translate-y-1 hover:border-amber-400/35 hover:shadow-[0_18px_50px_rgba(245,158,11,0.08)]"
              >
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.08] text-xl transition duration-300 group-hover/item:scale-110">
                      📦
                    </div>

                    <span className="text-sm font-black text-amber-400 transition-transform duration-300 group-hover/item:translate-x-1">
                      →
                    </span>
                  </div>

                  <p className="mt-5 text-sm font-black text-white">Pedidos</p>

                  <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                    Veja novos pedidos e acompanhe a operação.
                  </p>
                </div>
              </Link>

              <Link
                href="/admin/produtos"
                className="group/item relative overflow-hidden rounded-[22px] border border-cyan-400/15 bg-cyan-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-cyan-400/35 hover:shadow-[0_18px_50px_rgba(34,211,238,0.07)]"
              >
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.07] text-xl transition duration-300 group-hover/item:scale-110">
                      🍺
                    </div>

                    <span className="text-sm font-black text-cyan-400 transition-transform duration-300 group-hover/item:translate-x-1">
                      →
                    </span>
                  </div>

                  <p className="mt-5 text-sm font-black text-white">Produtos</p>

                  <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                    Cadastre, edite e organize o catálogo.
                  </p>
                </div>
              </Link>

              <Link
                href="/admin/estoque"
                className="group/item relative overflow-hidden rounded-[22px] border border-emerald-400/15 bg-emerald-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-emerald-400/35 hover:shadow-[0_18px_50px_rgba(16,185,129,0.07)]"
              >
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.07] text-xl transition duration-300 group-hover/item:scale-110">
                      📊
                    </div>

                    <span className="text-sm font-black text-emerald-400 transition-transform duration-300 group-hover/item:translate-x-1">
                      →
                    </span>
                  </div>

                  <p className="mt-5 text-sm font-black text-white">Estoque</p>

                  <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                    Controle quantidades e entradas de mercadoria.
                  </p>
                </div>
              </Link>

              <Link
                href="/admin/estoque/movimentacoes"
                className="group/item relative overflow-hidden rounded-[22px] border border-purple-400/15 bg-purple-400/[0.035] p-5 transition duration-500 hover:-translate-y-1 hover:border-purple-400/35 hover:shadow-[0_18px_50px_rgba(168,85,247,0.07)]"
              >
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-purple-400/15 bg-purple-400/[0.07] text-xl transition duration-300 group-hover/item:scale-110">
                      📋
                    </div>

                    <span className="text-sm font-black text-purple-400 transition-transform duration-300 group-hover/item:translate-x-1">
                      →
                    </span>
                  </div>

                  <p className="mt-5 text-sm font-black text-white">
                    Movimentações
                  </p>

                  <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                    Consulte todo o histórico de entradas e saídas.
                  </p>
                </div>
              </Link>
            </div>

            <div className="relative mt-6 flex items-center gap-2 border-t border-white/[0.05] pt-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-700">
                Painel operacional disponível
              </p>
            </div>

            <div className="absolute bottom-0 left-0 h-px w-0 bg-linear-to-r from-transparent via-amber-400/50 to-transparent transition-all duration-700 group-hover/atalhos:w-full" />
          </section>
        </div>

        {/* ÚLTIMOS PEDIDOS */}

        <section className="animate-slide-up relative mt-8 overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)]">
          {/* GLOW */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-amber-400/[0.05] blur-[110px]"
          />

          {/* CABEÇALHO */}
          <div className="relative flex items-end justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Operação recente
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Últimos pedidos
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Acompanhe rapidamente as movimentações mais recentes.
              </p>
            </div>

            <Link
              href="/admin/pedidos"
              className="group/ver hidden items-center gap-2 rounded-full border border-amber-400/15 bg-amber-400/[0.055] px-3 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-amber-300 transition hover:border-amber-400/30 hover:bg-amber-400/[0.09] sm:flex"
            >
              Ver todos
              <span className="transition-transform duration-300 group-hover/ver:translate-x-1">
                →
              </span>
            </Link>
          </div>

          {ultimosPedidos.length === 0 ? (
            <div className="relative mt-7 rounded-[22px] border border-white/[0.06] bg-black/20 p-7 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/[0.06] bg-white/[0.03] text-2xl">
                📦
              </div>

              <p className="mt-4 font-black text-zinc-400">
                Nenhum pedido recebido ainda
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Os pedidos mais recentes aparecerão aqui automaticamente.
              </p>
            </div>
          ) : (
            <div className="relative mt-7 space-y-3">
              {ultimosPedidos.map((pedido, indice) => {
                const recebido = pedido.status === "recebido";
                const preparando = pedido.status === "em_preparacao";
                const saiuEntrega = pedido.status === "saiu_entrega";
                const entregue = pedido.status === "entregue";
                const cancelado = pedido.status === "cancelado";

                return (
                  <Link
                    key={pedido.id}
                    href={`/admin/pedidos/${pedido.id}`}
                    className={`group/pedido relative flex flex-col gap-4 overflow-hidden rounded-[22px] border p-4 transition duration-500 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between ${
                      recebido
                        ? "border-amber-400/20 bg-amber-400/[0.045] hover:border-amber-400/40 hover:shadow-[0_18px_55px_rgba(245,158,11,0.08)]"
                        : preparando
                          ? "border-orange-400/15 bg-orange-400/[0.035] hover:border-orange-400/30"
                          : saiuEntrega
                            ? "border-blue-400/15 bg-blue-400/[0.035] hover:border-blue-400/30"
                            : entregue
                              ? "border-emerald-400/15 bg-emerald-400/[0.03] hover:border-emerald-400/25"
                              : cancelado
                                ? "border-red-400/10 bg-red-400/[0.025] opacity-75 hover:opacity-100"
                                : "border-white/[0.06] bg-black/20 hover:border-white/[0.12]"
                    }`}
                    style={{
                      animationDelay: `${indice * 70}ms`,
                    }}
                  >
                    {/* GLOW DO PEDIDO */}
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full blur-3xl opacity-0 transition duration-500 group-hover/pedido:opacity-100 ${
                        recebido
                          ? "bg-amber-400/10"
                          : preparando
                            ? "bg-orange-400/08"
                            : saiuEntrega
                              ? "bg-blue-400/08"
                              : entregue
                                ? "bg-emerald-400/08"
                                : cancelado
                                  ? "bg-red-400/08"
                                  : "bg-white/[0.04]"
                      }`}
                    />

                    <div className="relative flex min-w-0 items-center gap-4">
                      {/* ÍCONE / ID */}
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border text-lg font-black transition duration-300 group-hover/pedido:scale-110 ${
                          recebido
                            ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-400"
                            : preparando
                              ? "border-orange-400/20 bg-orange-400/[0.07] text-orange-400"
                              : saiuEntrega
                                ? "border-blue-400/20 bg-blue-400/[0.07] text-blue-400"
                                : entregue
                                  ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-400"
                                  : cancelado
                                    ? "border-red-400/20 bg-red-400/[0.07] text-red-400"
                                    : "border-white/[0.07] bg-white/[0.03] text-zinc-500"
                        }`}
                      >
                        #{pedido.id}
                      </div>

                      {/* CLIENTE */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-black text-white">
                            {pedido.nome_cliente}
                          </p>

                          {recebido && (
                            <span className="flex items-center gap-1.5 rounded-full bg-amber-400 px-2 py-1 text-[7px] font-black uppercase tracking-[0.09em] text-zinc-950">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-950 opacity-40" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-950" />
                              </span>
                              Novo
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-600">
                          {formatarDataHora(pedido.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* DIREITA */}
                    <div className="relative flex items-center justify-between gap-5 border-t border-white/[0.05] pt-3 sm:border-0 sm:pt-0">
                      <div className="sm:text-right">
                        <p className="text-lg font-black tracking-[-0.03em] text-white">
                          {formatarPreco(Number(pedido.total))}
                        </p>

                        <span
                          className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.08em] ${
                            recebido
                              ? "border-amber-400/15 bg-amber-400/[0.07] text-amber-300"
                              : preparando
                                ? "border-orange-400/15 bg-orange-400/[0.07] text-orange-300"
                                : saiuEntrega
                                  ? "border-blue-400/15 bg-blue-400/[0.07] text-blue-300"
                                  : entregue
                                    ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
                                    : cancelado
                                      ? "border-red-400/15 bg-red-400/[0.07] text-red-300"
                                      : "border-white/[0.06] bg-white/[0.03] text-zinc-500"
                          }`}
                        >
                          {formatarStatus(pedido.status)}
                        </span>
                      </div>

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.025] text-xs text-zinc-600 transition duration-300 group-hover/pedido:translate-x-1 group-hover/pedido:border-amber-400/20 group-hover/pedido:text-amber-400">
                        →
                      </div>
                    </div>

                    {/* LINHA INFERIOR */}
                    <div
                      className={`absolute bottom-0 left-0 h-px w-0 transition-all duration-700 group-hover/pedido:w-full ${
                        recebido
                          ? "bg-linear-to-r from-transparent via-amber-400 to-transparent"
                          : preparando
                            ? "bg-linear-to-r from-transparent via-orange-400 to-transparent"
                            : saiuEntrega
                              ? "bg-linear-to-r from-transparent via-blue-400 to-transparent"
                              : entregue
                                ? "bg-linear-to-r from-transparent via-emerald-400 to-transparent"
                                : cancelado
                                  ? "bg-linear-to-r from-transparent via-red-400 to-transparent"
                                  : "bg-linear-to-r from-transparent via-white/30 to-transparent"
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          )}

          {/* LINK MOBILE */}
          <Link
            href="/admin/pedidos"
            className="pressable mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500 transition hover:border-amber-400/20 hover:text-amber-300 sm:hidden"
          >
            Ver todos os pedidos
            <span>→</span>
          </Link>

          <div className="relative mt-6 flex items-center gap-2 border-t border-white/[0.05] pt-4">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>

            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-700">
              Atualização automática ativa
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

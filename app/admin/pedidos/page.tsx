import Link from "next/link";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import OrderStatusButtons from "../../../components/OrderStatusButtons";
import AdminAutoRefresh from "../../../components/AdminAutoRefresh";
import AdminNavigation from "../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

type AdminPedidosPageProps = {
  searchParams: Promise<{
    busca?: string;
    status?: string;
    pagamento?: string;
    pagina?: string;
  }>;
};

export default async function AdminPedidosPage({
  searchParams,
}: AdminPedidosPageProps) {
  const parametros = await searchParams;

  const busca = parametros.busca?.trim() ?? "";
  const statusSelecionado = parametros.status ?? "";
  const pagamentoSelecionado = parametros.pagamento ?? "";
  const paginaAtual = Math.max(1, Number(parametros.pagina) || 1);

  const pedidosPorPagina = 10;

  const inicioPagina = (paginaAtual - 1) * pedidosPorPagina;

  const fimPagina = inicioPagina + pedidosPorPagina - 1;
  // Último pedido REAL da loja.
  // É usado pelos alertas e não pode depender dos filtros.
  const { data: ultimoPedido } = await supabaseAdmin
    .from("pedidos")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ultimoPedidoId = Number(ultimoPedido?.id ?? 0);

  // Consulta que será filtrada para exibição no painel.
  let consultaPedidos = supabaseAdmin
    .from("pedidos")
    .select(
      `
    id,
    codigo_acesso,
    created_at,
    nome_cliente,
    forma_pagamento,
    pagamento_confirmado,
    total,
    status,
    telefone
  `,
      {
        count: "exact",
      },
    )
    .order("created_at", { ascending: false });

  // Busca pelo nome do cliente.
  // Se digitar somente um número, procura também pelo número do pedido.
  if (busca) {
    const numeroPedido = Number(busca);

    if (Number.isInteger(numeroPedido) && numeroPedido > 0) {
      consultaPedidos = consultaPedidos.or(
        `nome_cliente.ilike.%${busca}%,id.eq.${numeroPedido}`,
      );
    } else {
      consultaPedidos = consultaPedidos.ilike("nome_cliente", `%${busca}%`);
    }
  }

  // Filtro por status
  const statusPermitidos = [
    "recebido",
    "em_preparacao",
    "saiu_entrega",
    "entregue",
    "cancelado",
  ];

  if (statusPermitidos.includes(statusSelecionado)) {
    consultaPedidos = consultaPedidos.eq("status", statusSelecionado);
  }

  // Filtro por pagamento
  if (
    pagamentoSelecionado === "pix" ||
    pagamentoSelecionado === "cartao_entrega" ||
    pagamentoSelecionado === "dinheiro"
  ) {
    consultaPedidos = consultaPedidos.eq(
      "forma_pagamento",
      pagamentoSelecionado,
    );
  }

  if (pagamentoSelecionado === "pix_pendente") {
    consultaPedidos = consultaPedidos
      .eq("forma_pagamento", "pix")
      .eq("pagamento_confirmado", false);
  }

  if (pagamentoSelecionado === "pix_pago") {
    consultaPedidos = consultaPedidos
      .eq("forma_pagamento", "pix")
      .eq("pagamento_confirmado", true);
  }
  consultaPedidos = consultaPedidos.range(inicioPagina, fimPagina);

  const { data: pedidos, error, count: totalPedidos } = await consultaPedidos;
  const totalPaginas = Math.max(
    1,
    Math.ceil((totalPedidos ?? 0) / pedidosPorPagina),
  );
  // Resumo operacional.
  // Essas informações NÃO dependem dos filtros da tela.

  const { data: pedidosAbertosResumo } = await supabaseAdmin
    .from("pedidos")
    .select("status")
    .in("status", ["recebido", "em_preparacao", "saiu_entrega"]);

  const quantidadeRecebidos =
    pedidosAbertosResumo?.filter((pedido) => pedido.status === "recebido")
      .length ?? 0;

  const quantidadePreparacao =
    pedidosAbertosResumo?.filter((pedido) => pedido.status === "em_preparacao")
      .length ?? 0;

  const quantidadeSaiuEntrega =
    pedidosAbertosResumo?.filter((pedido) => pedido.status === "saiu_entrega")
      .length ?? 0;

  // Início e fim do dia no horário de Brasília
  const dataHojeBrasil = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const inicioHoje = new Date(`${dataHojeBrasil}T00:00:00-03:00`);

  const fimHoje = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  const { data: pedidosHoje } = await supabaseAdmin
    .from("pedidos")
    .select("total, status")
    .gte("created_at", inicioHoje.toISOString())
    .lt("created_at", fimHoje.toISOString());

  const faturamentoHoje =
    pedidosHoje?.reduce((total, pedido) => {
      if (pedido.status === "cancelado") {
        return total;
      }

      return total + Number(pedido.total);
    }, 0) ?? 0;

  if (error) {
    console.error("Erro ao buscar pedidos:", error);
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminNavigation />
          <h1 className="text-3xl font-black">Painel de pedidos</h1>

          <div className="mt-8 rounded-2xl border border-red-900 bg-red-950/40 p-6 text-red-300">
            Não foi possível carregar os pedidos.
          </div>
        </div>
      </main>
    );
  }
  function criarUrlPagina(pagina: number) {
    const params = new URLSearchParams();

    if (busca) {
      params.set("busca", busca);
    }

    if (statusSelecionado) {
      params.set("status", statusSelecionado);
    }

    if (pagamentoSelecionado) {
      params.set("pagamento", pagamentoSelecionado);
    }

    if (pagina > 1) {
      params.set("pagina", String(pagina));
    }

    const query = params.toString();

    return query ? `/admin/pedidos?${query}` : "/admin/pedidos";
  }
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />
        <AdminAutoRefresh ultimoPedidoId={ultimoPedidoId} />
        <section className="animate-slide-up relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.22)] sm:p-7">
          {/* GLOW */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-amber-400/[0.055] blur-[110px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-orange-500/[0.035] blur-[120px]"
          />

          {/* GRID DECORATIVO */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "42px 42px",
            }}
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            {/* TÍTULO */}
            <div>
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400">
                  Operação de pedidos
                </p>

                <span className="hidden h-1 w-1 rounded-full bg-zinc-700 sm:block" />

                <span className="hidden text-[8px] font-black uppercase tracking-[0.12em] text-zinc-700 sm:block">
                  Gestão em tempo real
                </span>
              </div>

              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Central de <span className="brand-gradient-text">pedidos.</span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
                Acompanhe novos pedidos, pagamentos e etapas da operação em um
                único lugar.
              </p>
            </div>

            {/* STATUS */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-emerald-400">
                  Operação online
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                <span className="text-[10px]">↻</span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">
                  Atualização automática
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-amber-400/10 bg-amber-400/[0.04] px-3 py-2">
                <span className="text-[10px]">📦</span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-amber-400">
                  Fluxo operacional
                </span>
              </div>
            </div>
          </div>

          {/* LINHA INFERIOR */}
          <div className="relative mt-7 h-px w-full bg-linear-to-r from-amber-400/25 via-white/[0.05] to-transparent" />
        </section>
        <form
          method="GET"
          className="group/filtros relative mt-8 overflow-hidden rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.16)]"
        >
          {/* GLOW */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-400/[0.045] blur-[100px] transition duration-700 group-hover/filtros:bg-amber-400/[0.07]"
          />

          {/* CABEÇALHO */}
          <div className="relative mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-6 bg-amber-400" />

                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Consulta operacional
                </p>
              </div>

              <h2 className="mt-1 text-lg font-black tracking-[-0.025em] text-white">
                Localizar pedidos
              </h2>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[0.05] bg-black/20 px-3 py-1.5">
              <span className="text-[10px]">⌕</span>

              <span className="text-[7px] font-black uppercase tracking-[0.12em] text-zinc-600">
                Busca e filtros
              </span>
            </div>
          </div>

          {/* CAMPOS */}
          <div className="relative grid gap-3 lg:grid-cols-[minmax(280px,1fr)_220px_260px_auto] lg:items-end">
            {/* BUSCA */}
            <label className="group/campo block">
              <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                Cliente ou pedido
              </span>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-600 transition group-focus-within/campo:text-amber-400">
                  🔎
                </span>

                <input
                  type="text"
                  name="busca"
                  defaultValue={busca}
                  placeholder="Nome do cliente ou nº..."
                  className="h-13 w-full rounded-[16px] border border-white/[0.08] bg-black/25 py-3 pl-11 pr-4 text-sm font-bold text-white outline-none transition duration-300 placeholder:font-normal placeholder:text-zinc-700 hover:border-white/[0.13] focus:border-amber-400/50 focus:bg-amber-400/[0.025] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.05)]"
                />
              </div>
            </label>

            {/* STATUS */}
            <label className="group/campo block">
              <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                Status
              </span>

              <div className="relative">
                <select
                  name="status"
                  defaultValue={statusSelecionado}
                  className="h-13 w-full cursor-pointer appearance-none rounded-[16px] border border-white/[0.08] bg-black/25 px-4 pr-10 text-sm font-bold text-white outline-none transition duration-300 hover:border-white/[0.13] focus:border-amber-400/50 focus:bg-amber-400/[0.025] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.05)]"
                >
                  <option value="">Todos os status</option>
                  <option value="recebido">🟡 Recebidos</option>
                  <option value="em_preparacao">🟠 Em preparação</option>
                  <option value="saiu_entrega">🔵 Saiu para entrega</option>
                  <option value="entregue">🟢 Entregues</option>
                  <option value="cancelado">🔴 Cancelados</option>
                </select>

                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">
                  ▼
                </span>
              </div>
            </label>

            {/* PAGAMENTO */}
            <label className="group/campo block">
              <span className="mb-2 block text-[8px] font-black uppercase tracking-[0.12em] text-zinc-600">
                Pagamento
              </span>

              <div className="relative">
                <select
                  name="pagamento"
                  defaultValue={pagamentoSelecionado}
                  className="h-13 w-full cursor-pointer appearance-none rounded-[16px] border border-white/[0.08] bg-black/25 px-4 pr-10 text-sm font-bold text-white outline-none transition duration-300 hover:border-white/[0.13] focus:border-amber-400/50 focus:bg-amber-400/[0.025] focus:shadow-[0_0_0_3px_rgba(245,158,11,0.05)]"
                >
                  <option value="">Todos os pagamentos</option>
                  <option value="pix">PIX</option>
                  <option value="pix_pendente">
                    ⏳ PIX aguardando pagamento
                  </option>
                  <option value="pix_pago">✅ PIX pago</option>
                  <option value="cartao_entrega">💳 Cartão na entrega</option>
                  <option value="dinheiro">💵 Dinheiro na entrega</option>
                </select>

                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">
                  ▼
                </span>
              </div>
            </label>

            {/* BOTÃO */}
            <button
              type="submit"
              className="group/botao relative h-13 overflow-hidden rounded-[16px] border border-amber-300/30 bg-amber-400 px-7 text-sm font-black text-zinc-950 shadow-[0_12px_35px_rgba(245,158,11,0.12)] transition duration-300 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_16px_45px_rgba(245,158,11,0.2)]"
            >
              <span className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/25 transition-all duration-700 group-hover/botao:left-[120%]" />

              <span className="relative flex items-center justify-center gap-2">
                <span>⌕</span>
                Filtrar
              </span>
            </button>
          </div>

          {/* RODAPÉ */}
          <div className="relative mt-4 flex items-center gap-3 border-t border-white/[0.04] pt-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />

            <p className="text-[7px] font-black uppercase tracking-[0.12em] text-zinc-700">
              Combine os campos para refinar a consulta
            </p>
          </div>
        </form>

        {(busca || statusSelecionado || pagamentoSelecionado) && (
          <div className="mt-3">
            <Link
              href="/admin/pedidos"
              className="text-sm font-bold text-zinc-400 transition hover:text-amber-400"
            >
              ✕ Limpar filtros
            </Link>
          </div>
        )}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* NOVOS PEDIDOS */}
          <Link
            href="/admin/pedidos?status=recebido"
            className="group/card relative overflow-hidden rounded-[24px] border border-amber-400/20 bg-amber-400/[0.045] p-5 shadow-[0_18px_55px_rgba(245,158,11,0.05)] transition duration-500 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-[0_22px_70px_rgba(245,158,11,0.11)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-400/[0.09] blur-3xl transition duration-500 group-hover/card:bg-amber-400/[0.15]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="relative flex h-11 w-11 items-center justify-center rounded-[16px] border border-amber-400/20 bg-amber-400/[0.09] text-xl transition duration-300 group-hover/card:scale-110">
                  🔔
                  {quantidadeRecebidos > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                    </span>
                  )}
                </div>

                <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-zinc-950">
                  Atenção
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.13em] text-amber-400">
                Novos pedidos
              </p>

              <div className="mt-1 flex items-end justify-between gap-4">
                <p className="text-4xl font-black tracking-[-0.06em] text-white">
                  {quantidadeRecebidos}
                </p>

                <span className="mb-1 text-lg font-black text-amber-400 transition duration-300 group-hover/card:translate-x-1">
                  →
                </span>
              </div>

              <p className="mt-2 text-[9px] text-zinc-600">
                aguardando atendimento
              </p>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/30">
                <div
                  className={`h-full rounded-full bg-linear-to-r from-amber-500 to-amber-300 ${
                    quantidadeRecebidos > 0 ? "w-full" : "w-0"
                  }`}
                />
              </div>
            </div>
          </Link>

          {/* EM PREPARAÇÃO */}
          <Link
            href="/admin/pedidos?status=em_preparacao"
            className="group/card relative overflow-hidden rounded-[24px] border border-orange-400/20 bg-orange-400/[0.04] p-5 shadow-[0_18px_55px_rgba(251,146,60,0.04)] transition duration-500 hover:-translate-y-1 hover:border-orange-400/40 hover:shadow-[0_22px_70px_rgba(251,146,60,0.1)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-400/[0.08] blur-3xl transition duration-500 group-hover/card:bg-orange-400/[0.14]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-orange-400/20 bg-orange-400/[0.08] text-xl transition duration-300 group-hover/card:scale-110 group-hover/card:rotate-3">
                  🔥
                </div>

                <span className="rounded-full border border-orange-400/15 bg-orange-400/[0.07] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-orange-400">
                  Produção
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.13em] text-orange-400">
                Em preparação
              </p>

              <div className="mt-1 flex items-end justify-between gap-4">
                <p className="text-4xl font-black tracking-[-0.06em] text-white">
                  {quantidadePreparacao}
                </p>

                <span className="mb-1 text-lg font-black text-orange-400 transition duration-300 group-hover/card:translate-x-1">
                  →
                </span>
              </div>

              <p className="mt-2 text-[9px] text-zinc-600">
                pedidos sendo preparados
              </p>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/30">
                <div
                  className={`h-full rounded-full bg-linear-to-r from-orange-600 to-orange-300 ${
                    quantidadePreparacao > 0 ? "w-2/3" : "w-0"
                  }`}
                />
              </div>
            </div>
          </Link>

          {/* SAIU PARA ENTREGA */}
          <Link
            href="/admin/pedidos?status=saiu_entrega"
            className="group/card relative overflow-hidden rounded-[24px] border border-blue-400/20 bg-blue-400/[0.04] p-5 shadow-[0_18px_55px_rgba(96,165,250,0.04)] transition duration-500 hover:-translate-y-1 hover:border-blue-400/40 hover:shadow-[0_22px_70px_rgba(96,165,250,0.1)]"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-400/[0.08] blur-3xl transition duration-500 group-hover/card:bg-blue-400/[0.14]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-blue-400/20 bg-blue-400/[0.08] text-xl transition duration-300 group-hover/card:scale-110 group-hover/card:-rotate-3">
                  🚚
                </div>

                <span className="rounded-full border border-blue-400/15 bg-blue-400/[0.07] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-blue-400">
                  Entrega
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.13em] text-blue-400">
                Saiu para entrega
              </p>

              <div className="mt-1 flex items-end justify-between gap-4">
                <p className="text-4xl font-black tracking-[-0.06em] text-white">
                  {quantidadeSaiuEntrega}
                </p>

                <span className="mb-1 text-lg font-black text-blue-400 transition duration-300 group-hover/card:translate-x-1">
                  →
                </span>
              </div>

              <p className="mt-2 text-[9px] text-zinc-600">pedidos a caminho</p>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/30">
                <div
                  className={`h-full rounded-full bg-linear-to-r from-blue-600 to-cyan-300 ${
                    quantidadeSaiuEntrega > 0 ? "w-1/2" : "w-0"
                  }`}
                />
              </div>
            </div>
          </Link>

          {/* FATURAMENTO DE HOJE */}
          <div className="group/card relative overflow-hidden rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.04] p-5 shadow-[0_18px_55px_rgba(52,211,153,0.04)] transition duration-500 hover:-translate-y-1 hover:border-emerald-400/35 hover:shadow-[0_22px_70px_rgba(52,211,153,0.09)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-400/[0.08] blur-3xl transition duration-500 group-hover/card:bg-emerald-400/[0.14]"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-emerald-400/20 bg-emerald-400/[0.08] text-xl transition duration-300 group-hover/card:scale-110">
                  💰
                </div>

                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-400">
                  Hoje
                </span>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-400">
                Faturamento
              </p>

              <p className="mt-1 truncate text-3xl font-black tracking-[-0.055em] text-white">
                {formatarPreco(faturamentoHoje)}
              </p>

              <p className="mt-2 text-[9px] text-zinc-600">
                desconsiderando cancelados
              </p>

              <div className="mt-4 flex items-center gap-2 border-t border-emerald-400/[0.08] pt-3">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[7px] font-black uppercase tracking-[0.12em] text-emerald-400/60">
                  Receita acumulada do dia
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mt-10 overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          {/* GLOW */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-amber-400/[0.035] blur-[90px]"
          />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* TÍTULO */}
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-6 bg-amber-400" />

                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Fila operacional
                </p>
              </div>

              <div className="mt-1 flex flex-wrap items-end gap-3">
                <h2 className="text-xl font-black tracking-[-0.03em] text-white">
                  Pedidos encontrados
                </h2>

                <span className="mb-0.5 rounded-full border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-amber-400">
                  {totalPedidos ?? 0}{" "}
                  {totalPedidos === 1 ? "pedido" : "pedidos"}
                </span>
              </div>
            </div>

            {/* PAGINAÇÃO RESUMIDA */}
            {(totalPedidos ?? 0) > 0 && (
              <div className="flex items-center gap-3 rounded-full border border-white/[0.05] bg-black/20 px-4 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />

                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                  Mostrando{" "}
                  <span className="text-zinc-300">
                    {inicioPagina + 1}–
                    {Math.min(fimPagina + 1, totalPedidos ?? 0)}
                  </span>{" "}
                  de <span className="text-white">{totalPedidos}</span>
                </p>
              </div>
            )}
          </div>

          <div className="relative mt-4 h-px w-full bg-linear-to-r from-amber-400/15 via-white/[0.04] to-transparent" />
        </div>

        {!pedidos || pedidos.length === 0 ? (
          <section className="relative mt-6 overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-amber-400/[0.04] blur-[100px]"
            />

            <div className="relative mx-auto flex max-w-md flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-amber-400/15 bg-amber-400/[0.06] text-3xl">
                📭
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                Nenhum resultado
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                Nenhum pedido encontrado.
              </h2>

              <p className="mt-3 text-sm leading-6 text-zinc-500">
                Não encontramos pedidos com os critérios informados. Tente
                alterar a busca ou limpar os filtros.
              </p>

              {(busca || statusSelecionado || pagamentoSelecionado) && (
                <Link
                  href="/admin/pedidos"
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-[15px] border border-amber-300/20 bg-amber-400 px-5 py-2.5 text-sm font-black text-zinc-950 transition duration-300 hover:-translate-y-0.5 hover:bg-amber-300"
                >
                  <span>✕</span>
                  Limpar filtros
                </Link>
              )}
            </div>
          </section>
        ) : (
          <div className="mt-6 grid gap-4">
            {pedidos.map((pedido) => {
              const recebido = pedido.status === "recebido";
              const preparando = pedido.status === "em_preparacao";
              const saiuEntrega = pedido.status === "saiu_entrega";
              const entregue = pedido.status === "entregue";
              const cancelado = pedido.status === "cancelado";

              const estiloCard = recebido
                ? "border-amber-400/25 bg-amber-400/[0.04] hover:border-amber-400/45 hover:shadow-[0_25px_80px_rgba(245,158,11,0.08)]"
                : preparando
                  ? "border-orange-400/20 bg-orange-400/[0.035] hover:border-orange-400/40 hover:shadow-[0_25px_80px_rgba(251,146,60,0.07)]"
                  : saiuEntrega
                    ? "border-blue-400/20 bg-blue-400/[0.035] hover:border-blue-400/40 hover:shadow-[0_25px_80px_rgba(96,165,250,0.07)]"
                    : entregue
                      ? "border-emerald-400/15 bg-emerald-400/[0.025] hover:border-emerald-400/30 hover:shadow-[0_25px_80px_rgba(52,211,153,0.06)]"
                      : cancelado
                        ? "border-red-400/15 bg-red-400/[0.025] hover:border-red-400/25"
                        : "border-white/[0.07] bg-white/[0.025]";

              const estiloNumero = recebido
                ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-400"
                : preparando
                  ? "border-orange-400/20 bg-orange-400/[0.08] text-orange-400"
                  : saiuEntrega
                    ? "border-blue-400/20 bg-blue-400/[0.08] text-blue-400"
                    : entregue
                      ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-400"
                      : cancelado
                        ? "border-red-400/20 bg-red-400/[0.07] text-red-400"
                        : "border-white/[0.07] bg-white/[0.03] text-zinc-400";

              const estiloStatus = recebido
                ? "border-amber-400/15 bg-amber-400/[0.07] text-amber-400"
                : preparando
                  ? "border-orange-400/15 bg-orange-400/[0.07] text-orange-400"
                  : saiuEntrega
                    ? "border-blue-400/15 bg-blue-400/[0.07] text-blue-400"
                    : entregue
                      ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-400"
                      : cancelado
                        ? "border-red-400/15 bg-red-400/[0.07] text-red-400"
                        : "border-white/[0.07] bg-white/[0.03] text-zinc-400";

              const glow = recebido
                ? "bg-amber-400/[0.07]"
                : preparando
                  ? "bg-orange-400/[0.06]"
                  : saiuEntrega
                    ? "bg-blue-400/[0.06]"
                    : entregue
                      ? "bg-emerald-400/[0.05]"
                      : cancelado
                        ? "bg-red-400/[0.04]"
                        : "bg-white/[0.025]";

              return (
                <article
                  key={pedido.id}
                  className={`group/pedido relative overflow-hidden rounded-[28px] border p-5 transition duration-500 hover:-translate-y-0.5 sm:p-6 ${estiloCard}`}
                >
                  {/* GLOW */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-[110px] transition duration-700 ${glow}`}
                  />

                  {/* LINHA DE STATUS À ESQUERDA */}
                  <div
                    className={`absolute bottom-8 left-0 top-8 w-[2px] rounded-full ${
                      recebido
                        ? "bg-amber-400"
                        : preparando
                          ? "bg-orange-400"
                          : saiuEntrega
                            ? "bg-blue-400"
                            : entregue
                              ? "bg-emerald-400"
                              : cancelado
                                ? "bg-red-400/60"
                                : "bg-zinc-700"
                    }`}
                  />

                  <div className="relative">
                    {/* TOPO */}
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        {/* NÚMERO DO PEDIDO */}
                        <div
                          className={`flex h-14 min-w-14 shrink-0 items-center justify-center rounded-[19px] border px-3 text-base font-black transition duration-300 group-hover/pedido:scale-105 ${estiloNumero}`}
                        >
                          #{pedido.id}
                        </div>

                        {/* CLIENTE */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-600">
                              Cliente
                            </p>

                            {recebido && (
                              <span className="relative flex items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-1 text-[7px] font-black uppercase tracking-[0.08em] text-zinc-950">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-950 opacity-30" />
                                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-zinc-950" />
                                </span>
                                Novo
                              </span>
                            )}
                          </div>

                          <h2 className="mt-1 truncate text-xl font-black tracking-[-0.035em] text-white sm:text-2xl">
                            {pedido.nome_cliente}
                          </h2>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5">
                              <span className="text-[10px]">
                                {pedido.forma_pagamento === "pix"
                                  ? "◆"
                                  : pedido.forma_pagamento === "cartao_entrega"
                                    ? "💳"
                                    : "💵"}
                              </span>

                              <span className="text-[8px] font-black uppercase tracking-[0.09em] text-zinc-500">
                                {formatarPagamento(pedido.forma_pagamento)}
                              </span>
                            </div>

                            {pedido.forma_pagamento === "pix" && (
                              <span
                                className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${
                                  pedido.pagamento_confirmado
                                    ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-400"
                                    : "border-amber-400/15 bg-amber-400/[0.07] text-amber-400"
                                }`}
                              >
                                {pedido.pagamento_confirmado
                                  ? "✓ PIX pago"
                                  : "⏳ PIX pendente"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* TOTAL + STATUS */}
                      <div className="flex shrink-0 items-end justify-between gap-6 lg:flex-col lg:items-end">
                        <div className="lg:text-right">
                          <p className="text-[8px] font-black uppercase tracking-[0.13em] text-zinc-700">
                            Total do pedido
                          </p>

                          <p className="mt-1 text-2xl font-black tracking-[-0.045em] text-white">
                            {formatarPreco(Number(pedido.total))}
                          </p>
                        </div>

                        <div
                          className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${estiloStatus}`}
                        >
                          {formatarStatus(pedido.status)}
                        </div>
                      </div>
                    </div>

                    {/* DIVISOR */}
                    <div className="my-5 h-px w-full bg-linear-to-r from-white/[0.07] via-white/[0.04] to-transparent" />

                    {/* ÁREA OPERACIONAL */}
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              recebido
                                ? "bg-amber-400"
                                : preparando
                                  ? "bg-orange-400"
                                  : saiuEntrega
                                    ? "bg-blue-400"
                                    : entregue
                                      ? "bg-emerald-400"
                                      : cancelado
                                        ? "bg-red-400"
                                        : "bg-zinc-600"
                            }`}
                          />

                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
                            Controle operacional
                          </p>
                        </div>

                        <OrderStatusButtons
                          pedidoId={pedido.id}
                          codigoAcesso={pedido.codigo_acesso}
                          statusAtual={pedido.status}
                          telefone={pedido.telefone}
                          formaPagamento={pedido.forma_pagamento}
                          pagamentoConfirmado={pedido.pagamento_confirmado}
                        />
                      </div>

                      {/* DETALHES */}
                      <Link
                        href={`/admin/pedidos/${pedido.id}`}
                        className="group/detalhes flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-[15px] border border-white/[0.08] bg-white/[0.025] px-5 py-2.5 text-sm font-black text-zinc-300 transition duration-300 hover:-translate-y-0.5 hover:border-amber-400/30 hover:bg-amber-400/[0.05] hover:text-amber-400"
                      >
                        <span>Ver detalhes</span>

                        <span className="transition duration-300 group-hover/detalhes:translate-x-1">
                          →
                        </span>
                      </Link>
                    </div>
                  </div>

                  {/* LINHA INFERIOR */}
                  <div
                    className={`absolute bottom-0 left-1/2 h-px -translate-x-1/2 bg-linear-to-r from-transparent to-transparent transition-all duration-700 group-hover/pedido:w-4/5 ${
                      recebido
                        ? "w-2/3 via-amber-400/60"
                        : preparando
                          ? "w-1/2 via-orange-400/50"
                          : saiuEntrega
                            ? "w-1/2 via-blue-400/50"
                            : entregue
                              ? "w-1/3 via-emerald-400/40"
                              : cancelado
                                ? "w-1/4 via-red-400/30"
                                : "w-0 via-white/20"
                    }`}
                  />
                </article>
              );
            })}
          </div>
        )}
        {totalPaginas > 1 && (
          <section className="relative mt-8 overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-4 sm:p-5">
            {/* GLOW */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -right-20 h-48 w-48 rounded-full bg-amber-400/[0.035] blur-[90px]"
            />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* ANTERIOR */}
              {paginaAtual > 1 ? (
                <Link
                  href={criarUrlPagina(paginaAtual - 1)}
                  className="group/anterior flex min-h-11 items-center justify-center gap-2 rounded-[15px] border border-white/[0.08] bg-black/20 px-5 py-2.5 text-sm font-black text-zinc-400 transition duration-300 hover:-translate-y-0.5 hover:border-amber-400/30 hover:bg-amber-400/[0.05] hover:text-amber-400"
                >
                  <span className="transition duration-300 group-hover/anterior:-translate-x-1">
                    ←
                  </span>

                  <span>Anterior</span>
                </Link>
              ) : (
                <span className="flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-[15px] border border-white/[0.04] bg-black/10 px-5 py-2.5 text-sm font-black text-zinc-800">
                  ← Anterior
                </span>
              )}

              {/* CENTRO */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-px w-5 bg-amber-400/50" />

                  <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-600">
                    Navegação
                  </p>

                  <span className="h-px w-5 bg-amber-400/50" />
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-amber-400">
                    Página {paginaAtual}
                  </span>

                  <span className="text-[9px] font-black uppercase tracking-[0.08em] text-zinc-700">
                    de
                  </span>

                  <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-300">
                    {totalPaginas}
                  </span>
                </div>
              </div>

              {/* PRÓXIMA */}
              {paginaAtual < totalPaginas ? (
                <Link
                  href={criarUrlPagina(paginaAtual + 1)}
                  className="group/proxima flex min-h-11 items-center justify-center gap-2 rounded-[15px] border border-amber-300/20 bg-amber-400 px-5 py-2.5 text-sm font-black text-zinc-950 shadow-[0_12px_35px_rgba(245,158,11,0.10)] transition duration-300 hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_16px_45px_rgba(245,158,11,0.16)]"
                >
                  <span>Próxima</span>

                  <span className="transition duration-300 group-hover/proxima:translate-x-1">
                    →
                  </span>
                </Link>
              ) : (
                <span className="flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-[15px] border border-white/[0.04] bg-black/10 px-5 py-2.5 text-sm font-black text-zinc-800">
                  Próxima →
                </span>
              )}
            </div>

            {/* PROGRESSO */}
            <div className="relative mt-4 overflow-hidden rounded-full bg-black/30">
              <div
                className="h-1 rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (paginaAtual / totalPaginas) * 100),
                  )}%`,
                }}
              />
            </div>

            <p className="relative mt-2 text-center text-[7px] font-black uppercase tracking-[0.12em] text-zinc-800">
              progresso da listagem
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

import Link from "next/link";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import AdminNavigation from "../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

type AdminClientesPageProps = {
  searchParams: Promise<{
    busca?: string;
    segmento?: string;
    pagina?: string;
  }>;
};

type Cliente = {
  id: number;
  created_at: string;
  nome: string;
  telefone: string;
  telefone_normalizado: string | null;
};

type PedidoCliente = {
  id: number;
  cliente_id: number;
  created_at: string;
  total: number;
  status: string;
};

type SegmentoCliente =
  | "vip"
  | "frequente"
  | "recorrente"
  | "novo"
  | "inativo"
  | "sem_compras";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

function calcularDiasDesde(data: string | null) {
  if (!data) {
    return null;
  }

  const agora = new Date();
  const ultimaCompra = new Date(data);

  const diferenca = agora.getTime() - ultimaCompra.getTime();

  return Math.floor(diferenca / (1000 * 60 * 60 * 24));
}

function classificarCliente(
  quantidadePedidos: number,
  ultimaCompra: string | null,
): {
  valor: SegmentoCliente;
  nome: string;
  descricao: string;
  estilo: string;
} {
  if (quantidadePedidos === 0 || !ultimaCompra) {
    return {
      valor: "sem_compras",
      nome: "Sem compras",
      descricao: "Ainda não realizou pedidos",
      estilo: "border-zinc-500/15 bg-zinc-500/[0.06] text-zinc-400",
    };
  }

  const diasSemComprar = calcularDiasDesde(ultimaCompra);

  if (diasSemComprar !== null && diasSemComprar > 60) {
    return {
      valor: "inativo",
      nome: "Inativo",
      descricao: `Há ${diasSemComprar} dias sem comprar`,
      estilo: "border-red-400/15 bg-red-400/[0.06] text-red-400",
    };
  }

  if (quantidadePedidos >= 10) {
    return {
      valor: "vip",
      nome: "VIP",
      descricao: "10 ou mais pedidos",
      estilo: "border-violet-400/20 bg-violet-400/[0.08] text-violet-300",
    };
  }

  if (quantidadePedidos >= 5) {
    return {
      valor: "frequente",
      nome: "Frequente",
      descricao: "5 a 9 pedidos",
      estilo: "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-400",
    };
  }

  if (quantidadePedidos >= 2) {
    return {
      valor: "recorrente",
      nome: "Recorrente",
      descricao: "Já voltou a comprar",
      estilo: "border-blue-400/15 bg-blue-400/[0.07] text-blue-400",
    };
  }

  return {
    valor: "novo",
    nome: "Novo",
    descricao: "Primeira compra",
    estilo: "border-amber-400/15 bg-amber-400/[0.07] text-amber-400",
  };
}

export default async function AdminClientesPage({
  searchParams,
}: AdminClientesPageProps) {
  const parametros = await searchParams;

  const busca = parametros.busca?.trim() ?? "";
  const segmentoSelecionado = parametros.segmento ?? "";
  const paginaAtual = Math.max(1, Number(parametros.pagina) || 1);

  const clientesPorPagina = 10;

  const { data: clientesData, error: erroClientes } = await supabaseAdmin
    .from("clientes")
    .select(
      `
        id,
        created_at,
        nome,
        telefone,
        telefone_normalizado
      `,
    )
    .order("created_at", { ascending: false });

  const { data: pedidosData, error: erroPedidos } = await supabaseAdmin
    .from("pedidos")
    .select(
      `
        id,
        cliente_id,
        created_at,
        total,
        status
      `,
    );

  if (erroClientes || erroPedidos) {
    console.error("Erro ao carregar CRM:", {
      erroClientes,
      erroPedidos,
    });

    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminNavigation />

          <div className="mt-8 rounded-2xl border border-red-900 bg-red-950/40 p-6 text-red-300">
            Não foi possível carregar os clientes.
          </div>
        </div>
      </main>
    );
  }

  const clientes = (clientesData ?? []) as Cliente[];

  const pedidos = (pedidosData ?? []) as PedidoCliente[];

  // Pedidos cancelados não entram nas métricas do CRM.
  const pedidosValidos = pedidos.filter(
    (pedido) => pedido.status !== "cancelado",
  );

  const clientesComMetricas = clientes.map((cliente) => {
    const pedidosCliente = pedidosValidos.filter(
      (pedido) => Number(pedido.cliente_id) === Number(cliente.id),
    );

    const quantidadePedidos = pedidosCliente.length;

    const totalGasto = pedidosCliente.reduce(
      (total, pedido) => total + Number(pedido.total),
      0,
    );

    const ticketMedio =
      quantidadePedidos > 0 ? totalGasto / quantidadePedidos : 0;

    const pedidosOrdenados = [...pedidosCliente].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const ultimaCompra = pedidosOrdenados[0]?.created_at ?? null;

    const segmento = classificarCliente(quantidadePedidos, ultimaCompra);

    return {
      ...cliente,
      quantidadePedidos,
      totalGasto,
      ticketMedio,
      ultimaCompra,
      segmento,
    };
  });

  const buscaNormalizada = busca.toLowerCase().replace(/\D/g, "");

  let clientesFiltrados = clientesComMetricas.filter((cliente) => {
    if (!busca) {
      return true;
    }

    const nomeCombina = cliente.nome
      .toLowerCase()
      .includes(busca.toLowerCase());

    const telefoneLimpo = (
      cliente.telefone_normalizado ?? cliente.telefone
    ).replace(/\D/g, "");

    const telefoneCombina =
      buscaNormalizada.length > 0 && telefoneLimpo.includes(buscaNormalizada);

    return nomeCombina || telefoneCombina;
  });

  const segmentosPermitidos: SegmentoCliente[] = [
    "vip",
    "frequente",
    "recorrente",
    "novo",
    "inativo",
    "sem_compras",
  ];

  if (segmentosPermitidos.includes(segmentoSelecionado as SegmentoCliente)) {
    clientesFiltrados = clientesFiltrados.filter(
      (cliente) => cliente.segmento.valor === segmentoSelecionado,
    );
  }

  // Clientes de maior valor aparecem primeiro.
  clientesFiltrados.sort((a, b) => {
    if (b.totalGasto !== a.totalGasto) {
      return b.totalGasto - a.totalGasto;
    }

    return (
      new Date(b.ultimaCompra ?? 0).getTime() -
      new Date(a.ultimaCompra ?? 0).getTime()
    );
  });

  const totalClientes = clientesFiltrados.length;

  const totalPaginas = Math.max(
    1,
    Math.ceil(totalClientes / clientesPorPagina),
  );

  const paginaSegura = Math.min(paginaAtual, totalPaginas);

  const inicioPagina = (paginaSegura - 1) * clientesPorPagina;

  const fimPagina = inicioPagina + clientesPorPagina;

  const clientesPagina = clientesFiltrados.slice(inicioPagina, fimPagina);

  const totalClientesCadastrados = clientesComMetricas.length;

  const clientesAtivos = clientesComMetricas.filter((cliente) => {
    if (!cliente.ultimaCompra) {
      return false;
    }

    const dias = calcularDiasDesde(cliente.ultimaCompra);

    return dias !== null && dias <= 60;
  }).length;

  const clientesVip = clientesComMetricas.filter(
    (cliente) => cliente.segmento.valor === "vip",
  ).length;

  const totalPedidosCRM = clientesComMetricas.reduce(
    (total, cliente) => total + cliente.quantidadePedidos,
    0,
  );

  const receitaCRM = clientesComMetricas.reduce(
    (total, cliente) => total + cliente.totalGasto,
    0,
  );

  const ticketMedioGeral =
    totalPedidosCRM > 0 ? receitaCRM / totalPedidosCRM : 0;

  // =========================================================
  // INTELIGÊNCIA COMERCIAL
  // =========================================================

  // Top 3 clientes por faturamento
  const rankingFaturamento = [...clientesComMetricas]
    .filter((cliente) => cliente.quantidadePedidos > 0)
    .sort((a, b) => b.totalGasto - a.totalGasto)
    .slice(0, 3);

  // Top 3 clientes por frequência de compras
  const rankingPedidos = [...clientesComMetricas]
    .filter((cliente) => cliente.quantidadePedidos > 0)
    .sort((a, b) => {
      if (b.quantidadePedidos !== a.quantidadePedidos) {
        return b.quantidadePedidos - a.quantidadePedidos;
      }

      return b.totalGasto - a.totalGasto;
    })
    .slice(0, 3);

  // Clientes que estão há 30 dias ou mais sem comprar.
  // Não inclui clientes que nunca fizeram pedido.
  const clientesReativacao = clientesComMetricas
    .map((cliente) => ({
      ...cliente,
      diasSemComprar: calcularDiasDesde(cliente.ultimaCompra),
    }))
    .filter(
      (cliente) =>
        cliente.quantidadePedidos > 0 &&
        cliente.diasSemComprar !== null &&
        cliente.diasSemComprar >= 30,
    )
    .sort((a, b) => (b.diasSemComprar ?? 0) - (a.diasSemComprar ?? 0))
    .slice(0, 5);

  function criarUrlPagina(pagina: number) {
    const params = new URLSearchParams();

    if (busca) {
      params.set("busca", busca);
    }

    if (segmentoSelecionado) {
      params.set("segmento", segmentoSelecionado);
    }

    if (pagina > 1) {
      params.set("pagina", String(pagina));
    }

    const query = params.toString();

    return query ? `/admin/clientes?${query}` : "/admin/clientes";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />

        {/* CABEÇALHO */}
        <section className="relative overflow-hidden rounded-[30px] border border-white/[0.07] bg-white/[0.025] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.22)] sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-violet-500/[0.06] blur-[110px]"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-blue-500/[0.04] blur-[120px]"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-violet-400" />

              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-300">
                Relacionamento com clientes
              </p>
            </div>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
              Central de <span className="brand-gradient-text">clientes.</span>
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Acompanhe frequência, valor gasto e comportamento dos clientes do
              Depósito do Zé.
            </p>
          </div>
        </section>

        {/* MÉTRICAS */}
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-violet-400/15 bg-violet-400/[0.04] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-violet-300">
              Clientes cadastrados
            </p>

            <p className="mt-2 text-4xl font-black tracking-[-0.06em]">
              {totalClientesCadastrados}
            </p>

            <p className="mt-2 text-[9px] text-zinc-600">
              cadastros únicos por telefone
            </p>
          </div>

          <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/[0.04] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-emerald-400">
              Clientes ativos
            </p>

            <p className="mt-2 text-4xl font-black tracking-[-0.06em]">
              {clientesAtivos}
            </p>

            <p className="mt-2 text-[9px] text-zinc-600">
              compraram nos últimos 60 dias
            </p>
          </div>

          <div className="rounded-[24px] border border-amber-400/15 bg-amber-400/[0.04] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-amber-400">
              Clientes VIP
            </p>

            <p className="mt-2 text-4xl font-black tracking-[-0.06em]">
              {clientesVip}
            </p>

            <p className="mt-2 text-[9px] text-zinc-600">10 ou mais pedidos</p>
          </div>

          <div className="rounded-[24px] border border-blue-400/15 bg-blue-400/[0.04] p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.13em] text-blue-400">
              Ticket médio
            </p>

            <p className="mt-2 truncate text-3xl font-black tracking-[-0.055em]">
              {formatarPreco(ticketMedioGeral)}
            </p>

            <p className="mt-2 text-[9px] text-zinc-600">
              considerando pedidos não cancelados
            </p>
          </div>
        </section>

        {/* INTELIGÊNCIA COMERCIAL */}
        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-px w-7 bg-fuchsia-400" />

                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-fuchsia-300">
                  Inteligência comercial
                </p>
              </div>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                Quem merece atenção agora?
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Ranking de clientes e oportunidades para aumentar recompra e
                faturamento.
              </p>
            </div>

            <div className="rounded-full border border-fuchsia-400/10 bg-fuchsia-400/[0.04] px-3 py-2">
              <span className="text-[8px] font-black uppercase tracking-[0.1em] text-fuchsia-300">
                CRM comercial
              </span>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {/* TOP FATURAMENTO */}
            <div className="relative overflow-hidden rounded-[26px] border border-emerald-400/15 bg-emerald-400/[0.025] p-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/[0.06] blur-[80px]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-400">
                      Maior faturamento
                    </p>

                    <h3 className="mt-1 text-lg font-black text-white">
                      Top clientes
                    </h3>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-emerald-400/15 bg-emerald-400/[0.07]">
                    💰
                  </div>
                </div>

                {rankingFaturamento.length === 0 ? (
                  <p className="mt-6 text-sm text-zinc-600">
                    Ainda não há compras suficientes para gerar o ranking.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {rankingFaturamento.map((cliente, indice) => (
                      <Link
                        key={cliente.id}
                        href={`/admin/clientes/${cliente.id}`}
                        className="group flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-black/20 p-3 transition hover:border-emerald-400/20 hover:bg-emerald-400/[0.03]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] text-xs font-black text-emerald-400">
                            {indice + 1}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">
                              {cliente.nome}
                            </p>

                            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-600">
                              {cliente.quantidadePedidos} pedidos
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-400">
                            {formatarPreco(cliente.totalGasto)}
                          </p>

                          <span className="text-[10px] text-zinc-700 transition group-hover:text-emerald-400">
                            →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TOP FREQUÊNCIA */}
            <div className="relative overflow-hidden rounded-[26px] border border-blue-400/15 bg-blue-400/[0.025] p-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-400/[0.06] blur-[80px]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-blue-400">
                      Mais frequentes
                    </p>

                    <h3 className="mt-1 text-lg font-black text-white">
                      Top por pedidos
                    </h3>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-blue-400/15 bg-blue-400/[0.07]">
                    🔥
                  </div>
                </div>

                {rankingPedidos.length === 0 ? (
                  <p className="mt-6 text-sm text-zinc-600">
                    Ainda não há compras suficientes para gerar o ranking.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {rankingPedidos.map((cliente, indice) => (
                      <Link
                        key={cliente.id}
                        href={`/admin/clientes/${cliente.id}`}
                        className="group flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.05] bg-black/20 p-3 transition hover:border-blue-400/20 hover:bg-blue-400/[0.03]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-400/10 bg-blue-400/[0.05] text-xs font-black text-blue-400">
                            {indice + 1}
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">
                              {cliente.nome}
                            </p>

                            <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-600">
                              {formatarPreco(cliente.totalGasto)} gastos
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-lg font-black text-blue-400">
                            {cliente.quantidadePedidos}
                          </p>

                          <p className="text-[7px] font-black uppercase text-zinc-700">
                            pedidos
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* REATIVAÇÃO */}
            <div className="relative overflow-hidden rounded-[26px] border border-fuchsia-400/15 bg-fuchsia-400/[0.025] p-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-fuchsia-400/[0.06] blur-[80px]"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.15em] text-fuchsia-300">
                      Oportunidade
                    </p>

                    <h3 className="mt-1 text-lg font-black text-white">
                      Reativar clientes
                    </h3>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-fuchsia-400/15 bg-fuchsia-400/[0.07]">
                    📣
                  </div>
                </div>

                {clientesReativacao.length === 0 ? (
                  <div className="mt-6 rounded-[18px] border border-emerald-400/10 bg-emerald-400/[0.03] p-4">
                    <p className="text-sm font-black text-emerald-400">
                      Nenhum cliente para reativar agora.
                    </p>

                    <p className="mt-1 text-[9px] leading-4 text-zinc-600">
                      Não existem clientes com 30 dias ou mais sem comprar.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {clientesReativacao.map((cliente) => {
                      const numeroWhatsApp = (
                        cliente.telefone_normalizado ??
                        cliente.telefone.replace(/\D/g, "")
                      ).replace(/^55/, "");

                      return (
                        <div
                          key={cliente.id}
                          className="rounded-[18px] border border-white/[0.05] bg-black/20 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-white">
                                {cliente.nome}
                              </p>

                              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em] text-fuchsia-300">
                                {cliente.diasSemComprar} dias sem comprar
                              </p>
                            </div>

                            <a
                              href={`https://wa.me/55${numeroWhatsApp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2 text-[9px] font-black text-emerald-400 transition hover:bg-emerald-400/[0.12]"
                            >
                              WhatsApp
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FILTROS */}
        <form
          method="GET"
          className="mt-8 rounded-[26px] border border-white/[0.07] bg-white/[0.025] p-5"
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_240px_auto]">
            <input
              type="text"
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome ou WhatsApp..."
              className="h-13 rounded-[16px] border border-white/[0.08] bg-black/25 px-4 text-sm font-bold text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-400/50"
            />

            <select
              name="segmento"
              defaultValue={segmentoSelecionado}
              className="h-13 cursor-pointer rounded-[16px] border border-white/[0.08] bg-zinc-950 px-4 text-sm font-bold text-white outline-none focus:border-violet-400/50"
            >
              <option value="">Todos os clientes</option>
              <option value="vip">👑 VIP</option>
              <option value="frequente">💚 Frequentes</option>
              <option value="recorrente">🔵 Recorrentes</option>
              <option value="novo">🟡 Novos</option>
              <option value="inativo">🔴 Inativos</option>
              <option value="sem_compras">⚪ Sem compras</option>
            </select>

            <button
              type="submit"
              className="h-13 rounded-[16px] bg-violet-500 px-7 text-sm font-black text-white transition hover:bg-violet-400"
            >
              Filtrar
            </button>
          </div>
        </form>

        {(busca || segmentoSelecionado) && (
          <div className="mt-3">
            <Link
              href="/admin/clientes"
              className="text-sm font-bold text-zinc-400 transition hover:text-violet-300"
            >
              ✕ Limpar filtros
            </Link>
          </div>
        )}

        {/* TÍTULO DA LISTA */}
        <section className="mt-8 flex items-center justify-between gap-4 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-300">
              Base de clientes
            </p>

            <h2 className="mt-1 text-xl font-black">Clientes encontrados</h2>
          </div>

          <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-3 py-1.5 text-[9px] font-black text-violet-300">
            {totalClientes} {totalClientes === 1 ? "cliente" : "clientes"}
          </span>
        </section>

        {/* CLIENTES */}
        {clientesPagina.length === 0 ? (
          <section className="mt-6 rounded-[28px] border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center">
            <div className="text-4xl">👤</div>

            <h2 className="mt-4 text-2xl font-black">
              Nenhum cliente encontrado.
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Altere os filtros ou faça uma nova busca.
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-4">
            {clientesPagina.map((cliente) => {
              const numeroWhatsApp = (
                cliente.telefone_normalizado ??
                cliente.telefone.replace(/\D/g, "")
              ).replace(/^55/, "");

              return (
                <article
                  key={cliente.id}
                  className="group relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-white/[0.025] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-violet-400/20 sm:p-6"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.08em] ${cliente.segmento.estilo}`}
                        >
                          {cliente.segmento.nome}
                        </span>

                        <span className="text-[8px] font-bold text-zinc-700">
                          Cliente #{cliente.id}
                        </span>
                      </div>

                      <h2 className="mt-3 truncate text-2xl font-black tracking-[-0.035em] text-white">
                        {cliente.nome}
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <a
                          href={`https://wa.me/55${numeroWhatsApp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-1.5 text-[9px] font-black text-emerald-400 transition hover:border-emerald-400/30"
                        >
                          💬 {formatarTelefone(cliente.telefone)}
                        </a>

                        <span className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[9px] font-bold text-zinc-500">
                          Última compra: {formatarData(cliente.ultimaCompra)}
                        </span>
                      </div>

                      <p className="mt-3 text-[10px] text-zinc-600">
                        {cliente.segmento.descricao}
                      </p>
                    </div>

                    <div className="grid shrink-0 grid-cols-3 gap-3">
                      <div className="min-w-[100px] rounded-2xl border border-white/[0.05] bg-black/20 p-3 text-center">
                        <p className="text-[8px] font-black uppercase text-zinc-600">
                          Pedidos
                        </p>

                        <p className="mt-1 text-lg font-black text-white">
                          {cliente.quantidadePedidos}
                        </p>
                      </div>

                      <div className="min-w-[110px] rounded-2xl border border-white/[0.05] bg-black/20 p-3 text-center">
                        <p className="text-[8px] font-black uppercase text-zinc-600">
                          Total gasto
                        </p>

                        <p className="mt-1 text-sm font-black text-emerald-400">
                          {formatarPreco(cliente.totalGasto)}
                        </p>
                      </div>

                      <div className="min-w-[110px] rounded-2xl border border-white/[0.05] bg-black/20 p-3 text-center">
                        <p className="text-[8px] font-black uppercase text-zinc-600">
                          Ticket médio
                        </p>

                        <p className="mt-1 text-sm font-black text-amber-400">
                          {formatarPreco(cliente.ticketMedio)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-4">
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-700">
                      Histórico consolidado pelo WhatsApp
                    </p>

                    <Link
                      href={`/admin/clientes/${cliente.id}`}
                      className="group/historico rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-xs font-black text-zinc-400 transition duration-300 hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-violet-400/[0.05] hover:text-violet-300"
                    >
                      <span className="flex items-center gap-2">
                        Histórico
                        <span className="transition duration-300 group-hover/historico:translate-x-1">
                          →
                        </span>
                      </span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && (
          <section className="mt-8 flex items-center justify-between gap-4 rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-4">
            {paginaSegura > 1 ? (
              <Link
                href={criarUrlPagina(paginaSegura - 1)}
                className="rounded-[15px] border border-white/[0.08] px-5 py-2.5 text-sm font-black text-zinc-400 transition hover:border-violet-400/30 hover:text-violet-300"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="px-5 py-2.5 text-sm font-black text-zinc-800">
                ← Anterior
              </span>
            )}

            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600">
              Página <span className="text-white">{paginaSegura}</span> de{" "}
              <span className="text-white">{totalPaginas}</span>
            </p>

            {paginaSegura < totalPaginas ? (
              <Link
                href={criarUrlPagina(paginaSegura + 1)}
                className="rounded-[15px] bg-violet-500 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-400"
              >
                Próxima →
              </Link>
            ) : (
              <span className="px-5 py-2.5 text-sm font-black text-zinc-800">
                Próxima →
              </span>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

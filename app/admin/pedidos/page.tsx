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
        <div>
          <h1 className="text-4xl font-black">Pedidos</h1>

          <p className="mt-2 text-zinc-400">
            Acompanhe e gerencie os pedidos recebidos pela loja.
          </p>
        </div>
        <form
          method="GET"
          className="mt-8 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 lg:grid-cols-[1fr_220px_240px_auto]"
        >
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="🔎 Cliente ou nº do pedido..."
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          />

          <select
            name="status"
            defaultValue={statusSelecionado}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">Todos os status</option>

            <option value="recebido">🟡 Recebidos</option>

            <option value="em_preparacao">🟠 Em preparação</option>

            <option value="saiu_entrega">🔵 Saiu para entrega</option>

            <option value="entregue">🟢 Entregues</option>

            <option value="cancelado">🔴 Cancelados</option>
          </select>

          <select
            name="pagamento"
            defaultValue={pagamentoSelecionado}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">Todos os pagamentos</option>

            <option value="pix">PIX</option>

            <option value="pix_pendente">⏳ PIX aguardando pagamento</option>

            <option value="pix_pago">✅ PIX pago</option>

            <option value="cartao_entrega">💳 Cartão na entrega</option>

            <option value="dinheiro">💵 Dinheiro na entrega</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-amber-400 px-6 py-3 font-black text-zinc-950 transition hover:bg-amber-300"
          >
            Filtrar
          </button>
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
            href="/admin/pedidos?status=em_preparacao"
            className="rounded-2xl border border-orange-900/60 bg-orange-950/20 p-5 transition hover:border-orange-400"
          >
            <p className="text-sm font-black text-orange-400">
              🟠 Em preparação
            </p>

            <p className="mt-2 text-3xl font-black">{quantidadePreparacao}</p>

            <p className="mt-1 text-sm text-zinc-400">
              pedidos sendo preparados
            </p>
          </Link>

          <Link
            href="/admin/pedidos?status=saiu_entrega"
            className="rounded-2xl border border-blue-900/60 bg-blue-950/20 p-5 transition hover:border-blue-400"
          >
            <p className="text-sm font-black text-blue-400">
              🔵 Saiu para entrega
            </p>

            <p className="mt-2 text-3xl font-black">{quantidadeSaiuEntrega}</p>

            <p className="mt-1 text-sm text-zinc-400">pedidos a caminho</p>
          </Link>

          <div className="rounded-2xl border border-green-900/60 bg-green-950/20 p-5">
            <p className="text-sm font-black text-green-400">
              💰 Faturamento de hoje
            </p>

            <p className="mt-2 text-3xl font-black">
              {formatarPreco(faturamentoHoje)}
            </p>

            <p className="mt-1 text-sm text-zinc-400">
              desconsiderando cancelados
            </p>
          </div>
        </div>

        <div className="mt-10">
          <p className="text-sm text-zinc-400">
            {totalPedidos ?? 0}{" "}
            {totalPedidos === 1 ? "pedido encontrado" : "pedidos encontrados"}
          </p>

          {(totalPedidos ?? 0) > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              Mostrando {inicioPagina + 1}–
              {Math.min(fimPagina + 1, totalPedidos ?? 0)} de {totalPedidos}
            </p>
          )}
        </div>

        {!pedidos || pedidos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="text-xl font-black">Nenhum pedido recebido ainda.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5">
            {pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className={`rounded-2xl border p-6 transition ${
                  pedido.status === "recebido"
                    ? "border-amber-400/60 bg-amber-400/5"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-amber-400">
                      PEDIDO #{pedido.id}
                    </p>

                    {pedido.status === "recebido" && (
                      <span className="mt-2 inline-block rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-zinc-950">
                        Novo pedido
                      </span>
                    )}

                    <h2 className="mt-1 text-2xl font-black">
                      {pedido.nome_cliente}
                    </h2>
                    <div className="mt-2">
                      <p className="text-sm text-zinc-400">
                        {formatarPagamento(pedido.forma_pagamento)}
                      </p>

                      {pedido.forma_pagamento === "pix" && (
                        <span
                          className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-black ${
                            pedido.pagamento_confirmado
                              ? "bg-green-500/20 text-green-400"
                              : "bg-amber-400/10 text-amber-400"
                          }`}
                        >
                          {pedido.pagamento_confirmado
                            ? "✅ PIX pago"
                            : "⏳ Aguardando PIX"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="md:text-right">
                    <p className="text-sm text-zinc-500">Total</p>

                    <p className="text-2xl font-black text-amber-400">
                      {formatarPreco(Number(pedido.total))}
                    </p>

                    <p className="mt-2 font-bold">
                      {formatarStatus(pedido.status)}
                    </p>
                    <OrderStatusButtons
                      pedidoId={pedido.id}
                      codigoAcesso={pedido.codigo_acesso}
                      statusAtual={pedido.status}
                      telefone={pedido.telefone}
                      formaPagamento={pedido.forma_pagamento}
                      pagamentoConfirmado={pedido.pagamento_confirmado}
                    />
                    <Link
                      href={`/admin/pedidos/${pedido.id}`}
                      className="mt-4 inline-block rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-bold text-white transition hover:border-amber-400 hover:text-amber-400"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPaginas > 1 && (
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row">
            {paginaAtual > 1 ? (
              <Link
                href={criarUrlPagina(paginaAtual - 1)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-black transition hover:border-amber-400 hover:text-amber-400"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-black text-zinc-600">
                ← Anterior
              </span>
            )}

            <p className="text-sm font-bold text-zinc-400">
              Página <span className="text-white">{paginaAtual}</span> de{" "}
              <span className="text-white">{totalPaginas}</span>
            </p>

            {paginaAtual < totalPaginas ? (
              <Link
                href={criarUrlPagina(paginaAtual + 1)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-black transition hover:border-amber-400 hover:text-amber-400"
              >
                Próxima →
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-black text-zinc-600">
                Próxima →
              </span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

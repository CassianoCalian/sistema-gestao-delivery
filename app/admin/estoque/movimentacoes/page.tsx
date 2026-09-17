import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import AdminNavigation from "../../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

type MovimentacoesEstoquePageProps = {
  searchParams: Promise<{
    produto?: string;
    tipo?: string;
    pedido?: string;
    pagina?: string;
  }>;
};

function formatarTipo(tipo: string) {
  if (tipo === "venda") {
    return "🛒 Venda";
  }

  if (tipo === "cancelamento") {
    return "↩️ Cancelamento";
  }

  if (tipo === "ajuste_manual") {
    return "🛠️ Ajuste manual";
  }

  if (tipo === "entrada") {
    return "📥 Entrada";
  }

  return tipo;
}

export default async function MovimentacoesEstoquePage({
  searchParams,
}: MovimentacoesEstoquePageProps) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const parametros = await searchParams;

  const produtoSelecionado = parametros.produto?.trim() ?? "";

  const tipoSelecionado = parametros.tipo?.trim() ?? "";

  const pedidoSelecionado = parametros.pedido?.trim() ?? "";
  const paginaAtual = Math.max(1, Number(parametros.pagina) || 1);

  const movimentacoesPorPagina = 20;

  const inicioPagina = (paginaAtual - 1) * movimentacoesPorPagina;

  const fimPagina = inicioPagina + movimentacoesPorPagina - 1;

  let consultaMovimentacoes = supabaseAdmin
    .from("movimentacoes_estoque")
    .select(
      `
    id,
    created_at,
    produto_id,
    pedido_id,
    tipo,
    quantidade,
    estoque_anterior,
    estoque_novo,
    observacao
  `,
      {
        count: "exact",
      },
    )
    .order("created_at", {
      ascending: false,
    });

  const produtoId = Number(produtoSelecionado);

  if (Number.isInteger(produtoId) && produtoId > 0) {
    consultaMovimentacoes = consultaMovimentacoes.eq("produto_id", produtoId);
  }

  if (
    tipoSelecionado === "venda" ||
    tipoSelecionado === "cancelamento" ||
    tipoSelecionado === "ajuste_manual" ||
    tipoSelecionado === "entrada"
  ) {
    consultaMovimentacoes = consultaMovimentacoes.eq("tipo", tipoSelecionado);
  }

  const pedidoId = Number(pedidoSelecionado);

  if (Number.isInteger(pedidoId) && pedidoId > 0) {
    consultaMovimentacoes = consultaMovimentacoes.eq("pedido_id", pedidoId);
  }
  consultaMovimentacoes = consultaMovimentacoes.range(inicioPagina, fimPagina);

  const {
    data: movimentacoes,
    error,
    count: totalMovimentacoes,
  } = await consultaMovimentacoes;
  const totalPaginas = Math.max(
    1,
    Math.ceil((totalMovimentacoes ?? 0) / movimentacoesPorPagina),
  );

  if (error) {
    console.error("Erro ao buscar movimentações de estoque:", error);

    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNavigation />

          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-6 text-red-300">
            Não foi possível carregar o histórico de estoque.
          </div>
        </div>
      </main>
    );
  }
  function criarUrlPagina(pagina: number) {
    const params = new URLSearchParams();

    if (produtoSelecionado) {
      params.set("produto", produtoSelecionado);
    }

    if (tipoSelecionado) {
      params.set("tipo", tipoSelecionado);
    }

    if (pedidoSelecionado) {
      params.set("pedido", pedidoSelecionado);
    }

    if (pagina > 1) {
      params.set("pagina", String(pagina));
    }

    const query = params.toString();

    return query
      ? `/admin/estoque/movimentacoes?${query}`
      : "/admin/estoque/movimentacoes";
  }

  const { data: produtos } = await supabaseAdmin
    .from("produtos")
    .select("id, nome")
    .order("nome", { ascending: true });

  const produtosPorId = new Map(
    (produtos ?? []).map((produto) => [Number(produto.id), produto.nome]),
  );

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation />

        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
            Controle de estoque
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Histórico de movimentações
          </h1>

          <p className="mt-2 text-zinc-400">
            Consulte todas as entradas e saídas registradas no estoque.
          </p>

          <form
            method="GET"
            className="mt-8 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-[1fr_220px_200px_auto]"
          >
            <select
              name="produto"
              defaultValue={produtoSelecionado}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">Todos os produtos</option>

              {produtos?.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome}
                </option>
              ))}
            </select>

            <select
              name="tipo"
              defaultValue={tipoSelecionado}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">Todos os tipos</option>

              <option value="venda">🛒 Venda</option>

              <option value="cancelamento">↩️ Cancelamento</option>

              <option value="ajuste_manual">🛠️ Ajuste manual</option>

              <option value="entrada">📥 Entrada</option>
            </select>

            <input
              type="number"
              name="pedido"
              min="1"
              defaultValue={pedidoSelecionado}
              placeholder="Nº do pedido"
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
            />

            <button
              type="submit"
              className="rounded-xl bg-amber-400 px-6 py-3 font-black text-zinc-950 transition hover:bg-amber-300"
            >
              Filtrar
            </button>
          </form>

          {(produtoSelecionado || tipoSelecionado || pedidoSelecionado) && (
            <div className="mt-3">
              <Link
                href="/admin/estoque/movimentacoes"
                className="text-sm font-bold text-zinc-400 transition hover:text-amber-400"
              >
                ✕ Limpar filtros
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">
              {totalMovimentacoes ?? 0} movimentações encontradas
            </p>

            {(totalMovimentacoes ?? 0) > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Mostrando {inicioPagina + 1}–
                {Math.min(fimPagina + 1, totalMovimentacoes ?? 0)} de{" "}
                {totalMovimentacoes}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin/estoque/entrada"
              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
            >
              📥 Registrar entrada
            </Link>

            <Link
              href="/admin/produtos"
              className="text-sm font-bold text-zinc-400 transition hover:text-amber-400"
            >
              ← Voltar ao estoque
            </Link>
          </div>
        </div>

        {!movimentacoes || movimentacoes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-xl font-black">
              Nenhuma movimentação registrada.
            </p>

            <p className="mt-2 text-sm text-zinc-400">
              Vendas, cancelamentos e ajustes de estoque aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-4">Data</th>
                    <th className="px-5 py-4">Produto</th>
                    <th className="px-5 py-4">Tipo</th>
                    <th className="px-5 py-4">Quantidade</th>
                    <th className="px-5 py-4">Antes</th>
                    <th className="px-5 py-4">Depois</th>
                    <th className="px-5 py-4">Pedido</th>
                    <th className="px-5 py-4">Observação</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800">
                  {movimentacoes.map((movimentacao) => (
                    <tr
                      key={movimentacao.id}
                      className="transition hover:bg-zinc-800/40"
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-zinc-400">
                        {formatarData(movimentacao.created_at)}
                      </td>

                      <td className="px-5 py-4 font-bold">
                        {produtosPorId.get(Number(movimentacao.produto_id)) ??
                          `Produto #${movimentacao.produto_id}`}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 font-bold">
                        {formatarTipo(movimentacao.tipo)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 font-black ${
                            movimentacao.quantidade > 0
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {movimentacao.quantidade > 0
                            ? `+${movimentacao.quantidade}`
                            : movimentacao.quantidade}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-zinc-400">
                        {movimentacao.estoque_anterior}
                      </td>

                      <td className="px-5 py-4 font-black">
                        {movimentacao.estoque_novo}
                      </td>

                      <td className="px-5 py-4">
                        {movimentacao.pedido_id ? (
                          <Link
                            href={`/admin/pedidos/${movimentacao.pedido_id}`}
                            className="font-bold text-amber-400 transition hover:text-amber-300"
                          >
                            #{movimentacao.pedido_id}
                          </Link>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      <td className="max-w-xs px-5 py-4 text-zinc-400">
                        {movimentacao.observacao || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

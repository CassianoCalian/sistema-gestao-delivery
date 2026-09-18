import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import AdminNavigation from "../../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

type TipoMovimentacao =
  | "venda"
  | "cancelamento"
  | "ajuste_manual"
  | "entrada";

type MovimentacaoLegada = {
  id: number;
  created_at: string;
  produto_id: number;
  pedido_id: number | null;
  tipo: string;
  quantidade: number;
  estoque_anterior: number;
  estoque_novo: number;
  observacao: string | null;
};

type MovimentacaoCompartilhada = {
  id: number;
  created_at: string;
  estoque_compartilhado_id: number;
  pedido_id: number | null;
  quantidade_anterior: number;
  quantidade_nova: number;
  unidades_consumidas: number;
  observacao: string | null;
};

type MovimentacaoUnificada = {
  chave: string;
  created_at: string;
  origem: "produto" | "compartilhado";
  itemNome: string;
  pedido_id: number | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  estoque_anterior: number;
  estoque_novo: number;
  observacao: string | null;
};

type MovimentacoesEstoquePageProps = {
  searchParams: Promise<{
    produto?: string;
    tipo?: string;
    pedido?: string;
    pagina?: string;
  }>;
};

function formatarData(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function formatarTipo(tipo: TipoMovimentacao) {
  if (tipo === "venda") {
    return "Venda";
  }

  if (tipo === "cancelamento") {
    return "Cancelamento";
  }

  if (tipo === "ajuste_manual") {
    return "Ajuste manual";
  }

  if (tipo === "entrada") {
    return "Entrada";
  }

  return tipo;
}

function classeTipo(tipo: TipoMovimentacao) {
  if (tipo === "venda") {
    return "border-blue-900/60 bg-blue-950/40 text-blue-300";
  }

  if (tipo === "cancelamento") {
    return "border-purple-900/60 bg-purple-950/40 text-purple-300";
  }

  if (tipo === "entrada") {
    return "border-emerald-900/60 bg-emerald-950/40 text-emerald-300";
  }

  return "border-amber-900/60 bg-amber-950/40 text-amber-300";
}

function descobrirTipoCompartilhado(
  movimentacao: MovimentacaoCompartilhada,
): TipoMovimentacao {
  if (Number(movimentacao.unidades_consumidas) > 0) {
    return "venda";
  }

  const observacao = (movimentacao.observacao ?? "")
    .toLocaleLowerCase("pt-BR");

  if (observacao.includes("cancelamento")) {
    return "cancelamento";
  }

  if (
    observacao.includes("entrada física") ||
    observacao.includes("entrada fisica")
  ) {
    return "entrada";
  }

  return "ajuste_manual";
}

function tipoValido(tipo: string): tipo is TipoMovimentacao {
  return (
    tipo === "venda" ||
    tipo === "cancelamento" ||
    tipo === "ajuste_manual" ||
    tipo === "entrada"
  );
}

async function buscarTodasMovimentacoesLegadas(
  produtoId: number | null,
  pedidoId: number | null,
) {
  const resultado: MovimentacaoLegada[] = [];
  const tamanhoPagina = 1000;
  let inicio = 0;

  while (true) {
    let consulta = supabaseAdmin
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
      )
      .order("created_at", {
        ascending: false,
      })
      .range(inicio, inicio + tamanhoPagina - 1);

    if (produtoId !== null) {
      consulta = consulta.eq("produto_id", produtoId);
    }

    if (pedidoId !== null) {
      consulta = consulta.eq("pedido_id", pedidoId);
    }

    const { data, error } = await consulta;

    if (error) {
      throw new Error(error.message);
    }

    const lote = (data ?? []) as MovimentacaoLegada[];

    resultado.push(...lote);

    if (lote.length < tamanhoPagina) {
      break;
    }

    inicio += tamanhoPagina;
  }

  return resultado;
}

async function buscarTodasMovimentacoesCompartilhadas(
  estoqueCompartilhadoId: number | null,
  pedidoId: number | null,
  deveBuscar: boolean,
) {
  if (!deveBuscar) {
    return [] as MovimentacaoCompartilhada[];
  }

  const resultado: MovimentacaoCompartilhada[] = [];
  const tamanhoPagina = 1000;
  let inicio = 0;

  while (true) {
    let consulta = supabaseAdmin
      .from("movimentacoes_estoque_compartilhado")
      .select(
        `
          id,
          created_at,
          estoque_compartilhado_id,
          pedido_id,
          quantidade_anterior,
          quantidade_nova,
          unidades_consumidas,
          observacao
        `,
      )
      .order("created_at", {
        ascending: false,
      })
      .range(inicio, inicio + tamanhoPagina - 1);

    if (estoqueCompartilhadoId !== null) {
      consulta = consulta.eq(
        "estoque_compartilhado_id",
        estoqueCompartilhadoId,
      );
    }

    if (pedidoId !== null) {
      consulta = consulta.eq("pedido_id", pedidoId);
    }

    const { data, error } = await consulta;

    if (error) {
      throw new Error(error.message);
    }

    const lote = (data ?? []) as MovimentacaoCompartilhada[];

    resultado.push(...lote);

    if (lote.length < tamanhoPagina) {
      break;
    }

    inicio += tamanhoPagina;
  }

  return resultado;
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

  const paginaAtual = Math.max(
    1,
    Number(parametros.pagina) || 1,
  );

  const movimentacoesPorPagina = 20;

  const produtoNumero = Number(produtoSelecionado);

  const produtoId =
    Number.isInteger(produtoNumero) && produtoNumero > 0
      ? produtoNumero
      : null;

  const pedidoNumero = Number(pedidoSelecionado);

  const pedidoId =
    Number.isInteger(pedidoNumero) && pedidoNumero > 0
      ? pedidoNumero
      : null;

  const [
    produtosResultado,
    configuracoesResultado,
    estoquesCompartilhadosResultado,
  ] = await Promise.all([
    supabaseAdmin
      .from("produtos")
      .select("id, nome")
      .order("nome", {
        ascending: true,
      }),

    supabaseAdmin
      .from("produto_estoque_config")
      .select(
        `
          produto_id,
          estoque_compartilhado_id,
          quantidade_por_venda
        `,
      ),

    supabaseAdmin
      .from("estoques_compartilhados")
      .select("id, nome")
      .order("nome", {
        ascending: true,
      }),
  ]);

  if (
    produtosResultado.error ||
    configuracoesResultado.error ||
    estoquesCompartilhadosResultado.error
  ) {
    console.error(
      "Erro ao carregar informações auxiliares do estoque:",
      produtosResultado.error ??
        configuracoesResultado.error ??
        estoquesCompartilhadosResultado.error,
    );

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

  const produtos = produtosResultado.data ?? [];
  const configuracoes = configuracoesResultado.data ?? [];
  const estoquesCompartilhados =
    estoquesCompartilhadosResultado.data ?? [];

  const produtosPorId = new Map(
    produtos.map((produto) => [
      Number(produto.id),
      produto.nome,
    ]),
  );

  const estoquesCompartilhadosPorId = new Map(
    estoquesCompartilhados.map((estoque) => [
      Number(estoque.id),
      estoque.nome,
    ]),
  );

  const configuracaoPorProduto = new Map(
    configuracoes.map((configuracao) => [
      Number(configuracao.produto_id),
      {
        estoqueCompartilhadoId: Number(
          configuracao.estoque_compartilhado_id,
        ),
        quantidadePorVenda: Number(
          configuracao.quantidade_por_venda,
        ),
      },
    ]),
  );

  const configuracaoProdutoSelecionado =
    produtoId !== null
      ? configuracaoPorProduto.get(produtoId)
      : undefined;

  const estoqueCompartilhadoSelecionado =
    configuracaoProdutoSelecionado?.estoqueCompartilhadoId ??
    null;

  const deveBuscarCompartilhado =
    produtoId === null ||
    configuracaoProdutoSelecionado !== undefined;

  let movimentacoesLegadas: MovimentacaoLegada[] = [];
  let movimentacoesCompartilhadas: MovimentacaoCompartilhada[] =
    [];

  try {
    [
      movimentacoesLegadas,
      movimentacoesCompartilhadas,
    ] = await Promise.all([
      buscarTodasMovimentacoesLegadas(
        produtoId,
        pedidoId,
      ),

      buscarTodasMovimentacoesCompartilhadas(
        estoqueCompartilhadoSelecionado,
        pedidoId,
        deveBuscarCompartilhado,
      ),
    ]);
  } catch (erro) {
    console.error(
      "Erro ao buscar movimentações de estoque:",
      erro,
    );

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

  /*
   * Descobrimos a primeira movimentação física de cada estoque
   * compartilhado.
   *
   * A partir desse ponto, o histórico físico é a fonte oficial.
   * Assim evitamos mostrar duas vezes a mesma venda/entrada:
   *
   * movimentacoes_estoque
   * +
   * movimentacoes_estoque_compartilhado
   */
  const primeiraMovimentacaoFisicaPorEstoque = new Map<
    number,
    number
  >();

  for (const movimentacao of movimentacoesCompartilhadas) {
    const estoqueId = Number(
      movimentacao.estoque_compartilhado_id,
    );

    const timestamp = new Date(
      movimentacao.created_at,
    ).getTime();

    const atual =
      primeiraMovimentacaoFisicaPorEstoque.get(
        estoqueId,
      );

    if (atual === undefined || timestamp < atual) {
      primeiraMovimentacaoFisicaPorEstoque.set(
        estoqueId,
        timestamp,
      );
    }
  }

  const movimentacoes: MovimentacaoUnificada[] = [];

  for (const movimentacao of movimentacoesLegadas) {
    const produtoMovimentacaoId = Number(
      movimentacao.produto_id,
    );

    const configuracao =
      configuracaoPorProduto.get(
        produtoMovimentacaoId,
      );

    if (configuracao) {
      const primeiraMovimentacaoFisica =
        primeiraMovimentacaoFisicaPorEstoque.get(
          configuracao.estoqueCompartilhadoId,
        );

      if (
        primeiraMovimentacaoFisica !== undefined &&
        new Date(
          movimentacao.created_at,
        ).getTime() >= primeiraMovimentacaoFisica
      ) {
        continue;
      }
    }

    const tipo = tipoValido(movimentacao.tipo)
      ? movimentacao.tipo
      : "ajuste_manual";

    movimentacoes.push({
      chave: `produto-${movimentacao.id}`,
      created_at: movimentacao.created_at,
      origem: "produto",
      itemNome:
        produtosPorId.get(
          produtoMovimentacaoId,
        ) ??
        `Produto #${produtoMovimentacaoId}`,
      pedido_id: movimentacao.pedido_id,
      tipo,
      quantidade:
        Number(movimentacao.estoque_novo) -
        Number(movimentacao.estoque_anterior),
      estoque_anterior: Number(
        movimentacao.estoque_anterior,
      ),
      estoque_novo: Number(
        movimentacao.estoque_novo,
      ),
      observacao: movimentacao.observacao,
    });
  }

  for (const movimentacao of movimentacoesCompartilhadas) {
    const estoqueId = Number(
      movimentacao.estoque_compartilhado_id,
    );

    movimentacoes.push({
      chave: `compartilhado-${movimentacao.id}`,
      created_at: movimentacao.created_at,
      origem: "compartilhado",
      itemNome:
        estoquesCompartilhadosPorId.get(
          estoqueId,
        ) ??
        `Estoque físico #${estoqueId}`,
      pedido_id: movimentacao.pedido_id,
      tipo: descobrirTipoCompartilhado(
        movimentacao,
      ),
      quantidade:
        Number(movimentacao.quantidade_nova) -
        Number(movimentacao.quantidade_anterior),
      estoque_anterior: Number(
        movimentacao.quantidade_anterior,
      ),
      estoque_novo: Number(
        movimentacao.quantidade_nova,
      ),
      observacao: movimentacao.observacao,
    });
  }

  const movimentacoesFiltradas =
    movimentacoes
      .filter((movimentacao) => {
        if (
          tipoSelecionado &&
          tipoValido(tipoSelecionado) &&
          movimentacao.tipo !== tipoSelecionado
        ) {
          return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      );

  const totalMovimentacoes =
    movimentacoesFiltradas.length;

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      totalMovimentacoes /
        movimentacoesPorPagina,
    ),
  );

  const paginaSegura = Math.min(
    paginaAtual,
    totalPaginas,
  );

  const inicioPagina =
    (paginaSegura - 1) *
    movimentacoesPorPagina;

  const fimPagina =
    inicioPagina +
    movimentacoesPorPagina;

  const movimentacoesPagina =
    movimentacoesFiltradas.slice(
      inicioPagina,
      fimPagina,
    );

  function criarUrlPagina(pagina: number) {
    const params = new URLSearchParams();

    if (produtoSelecionado) {
      params.set(
        "produto",
        produtoSelecionado,
      );
    }

    if (tipoSelecionado) {
      params.set(
        "tipo",
        tipoSelecionado,
      );
    }

    if (pedidoSelecionado) {
      params.set(
        "pedido",
        pedidoSelecionado,
      );
    }

    if (pagina > 1) {
      params.set(
        "pagina",
        String(pagina),
      );
    }

    const query = params.toString();

    return query
      ? `/admin/estoque/movimentacoes?${query}`
      : "/admin/estoque/movimentacoes";
  }

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

          <p className="mt-2 max-w-3xl text-zinc-400">
            Consulte entradas, vendas, cancelamentos
            e ajustes do estoque normal e do estoque
            físico compartilhado.
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
              <option value="">
                Todos os produtos
              </option>

              {produtos.map((produto) => {
                const configuracao =
                  configuracaoPorProduto.get(
                    Number(produto.id),
                  );

                const nomeEstoque =
                  configuracao
                    ? estoquesCompartilhadosPorId.get(
                        configuracao.estoqueCompartilhadoId,
                      )
                    : null;

                return (
                  <option
                    key={produto.id}
                    value={produto.id}
                  >
                    {produto.nome}
                    {nomeEstoque
                      ? ` — estoque físico: ${nomeEstoque}`
                      : ""}
                  </option>
                );
              })}
            </select>

            <select
              name="tipo"
              defaultValue={tipoSelecionado}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
            >
              <option value="">
                Todos os tipos
              </option>

              <option value="venda">
                Venda
              </option>

              <option value="cancelamento">
                Cancelamento
              </option>

              <option value="ajuste_manual">
                Ajuste manual
              </option>

              <option value="entrada">
                Entrada
              </option>
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

          {(
            produtoSelecionado ||
            tipoSelecionado ||
            pedidoSelecionado
          ) && (
            <div className="mt-3">
              <Link
                href="/admin/estoque/movimentacoes"
                className="text-sm font-bold text-zinc-400 transition hover:text-amber-400"
              >
                Limpar filtros
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">
              {totalMovimentacoes} movimentações
              encontradas
            </p>

            {totalMovimentacoes > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Mostrando{" "}
                {inicioPagina + 1}–
                {Math.min(
                  fimPagina,
                  totalMovimentacoes,
                )}{" "}
                de {totalMovimentacoes}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin/estoque/compartilhado"
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-amber-400 hover:text-amber-400"
            >
              Estoque compartilhado
            </Link>

            <Link
              href="/admin/estoque/entrada"
              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
            >
              Registrar entrada
            </Link>

            <Link
              href="/admin/estoque"
              className="text-sm font-bold text-zinc-400 transition hover:text-amber-400"
            >
              Voltar ao estoque
            </Link>
          </div>
        </div>

        {movimentacoesPagina.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <p className="font-bold text-zinc-300">
              Nenhuma movimentação encontrada.
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Altere os filtros ou registre uma nova
              movimentação de estoque.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {movimentacoesPagina.map(
              (movimentacao) => (
                <div
                  key={movimentacao.chave}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${classeTipo(
                            movimentacao.tipo,
                          )}`}
                        >
                          {formatarTipo(
                            movimentacao.tipo,
                          )}
                        </span>

                        <span
                          className={
                            movimentacao.origem ===
                            "compartilhado"
                              ? "rounded-full border border-amber-900/60 bg-amber-950/30 px-3 py-1 text-xs font-bold text-amber-300"
                              : "rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-300"
                          }
                        >
                          {movimentacao.origem ===
                          "compartilhado"
                            ? "Estoque físico"
                            : "Produto"}
                        </span>
                      </div>

                      <h2 className="mt-3 truncate text-lg font-black text-white">
                        {movimentacao.itemNome}
                      </h2>

                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
                        <span>
                          {formatarData(
                            movimentacao.created_at,
                          )}
                        </span>

                        {movimentacao.pedido_id && (
                          <span>
                            Pedido #
                            {
                              movimentacao.pedido_id
                            }
                          </span>
                        )}
                      </div>

                      {movimentacao.observacao && (
                        <p className="mt-3 text-sm text-zinc-500">
                          {
                            movimentacao.observacao
                          }
                        </p>
                      )}
                    </div>

                    <div className="grid min-w-[280px] grid-cols-3 gap-3">
                      <div className="rounded-xl bg-zinc-950 p-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Antes
                        </p>

                        <p className="mt-1 text-lg font-black">
                          {
                            movimentacao.estoque_anterior
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-zinc-950 p-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Movimento
                        </p>

                        <p
                          className={`mt-1 text-lg font-black ${
                            movimentacao.quantidade >
                            0
                              ? "text-emerald-400"
                              : movimentacao.quantidade <
                                  0
                                ? "text-red-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {movimentacao.quantidade >
                          0
                            ? "+"
                            : ""}
                          {
                            movimentacao.quantidade
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-zinc-950 p-3 text-center">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                          Depois
                        </p>

                        <p className="mt-1 text-lg font-black">
                          {
                            movimentacao.estoque_novo
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}

        {totalPaginas > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            {paginaSegura > 1 ? (
              <Link
                href={criarUrlPagina(
                  paginaSegura - 1,
                )}
                className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-amber-400 hover:text-amber-400"
              >
                Anterior
              </Link>
            ) : (
              <span className="rounded-xl border border-zinc-800 px-5 py-3 text-sm font-bold text-zinc-700">
                Anterior
              </span>
            )}

            <span className="text-sm font-bold text-zinc-400">
              Página {paginaSegura} de{" "}
              {totalPaginas}
            </span>

            {paginaSegura < totalPaginas ? (
              <Link
                href={criarUrlPagina(
                  paginaSegura + 1,
                )}
                className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-amber-400 hover:text-amber-400"
              >
                Próxima
              </Link>
            ) : (
              <span className="rounded-xl border border-zinc-800 px-5 py-3 text-sm font-bold text-zinc-700">
                Próxima
              </span>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

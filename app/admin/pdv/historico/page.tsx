import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

type Parametros = {
  data?: string | string[];
  pagamento?: string | string[];
  pagina?: string | string[];
};

type FormaPagamento = "pix" | "dinheiro" | "debito" | "credito";

type Venda = {
  id: number;
  created_at: string;
  cliente_id: number | null;
  forma_pagamento: string;
  subtotal: number | string;
  taxa_cartao: number | string;
  total: number | string;
  status: string;
};

type ItemVenda = {
  id: number;
  venda_id: number;
  nome_produto: string;
  preco_unitario: number | string;
  quantidade: number;
  subtotal: number | string;
};

type Cliente = {
  id: number;
  nome: string;
};

const FORMAS = [
  { id: "dinheiro", nome: "Dinheiro", icone: "💵" },
  { id: "pix", nome: "Pix", icone: "◆" },
  { id: "debito", nome: "Débito", icone: "💳" },
  { id: "credito", nome: "Crédito", icone: "💳" },
] as const;

const LIMITE_CONSULTA = 500;
const MAXIMO_CONSULTAS = 20;
const VENDAS_POR_PAGINA = 20;

function dinheiro(valor: number | string) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function somarValores(valores: number[]) {
  const centavos = valores.reduce(
    (soma, valor) => soma + Math.round(valor * 100),
    0,
  );

  return centavos / 100;
}

function dataHojeBrasil() {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const obter = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";

  return `${obter("year")}-${obter("month")}-${obter("day")}`;
}

function dataValida(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const data = new Date(`${valor}T12:00:00.000Z`);

  return (
    !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
  );
}

function diaSeguinte(valor: string) {
  const data = new Date(`${valor}T12:00:00.000Z`);

  data.setUTCDate(data.getUTCDate() + 1);

  return data.toISOString().slice(0, 10);
}

function primeiroParametro(valor?: string | string[]) {
  return Array.isArray(valor) ? valor[0] : valor;
}

function rotuloPagamento(valor: string) {
  return FORMAS.find((forma) => forma.id === valor)?.nome ?? valor;
}

function horarioBrasil(valor: string) {
  return new Date(valor).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatarData(valor: string) {
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function linkPagina(data: string, pagamento: string, pagina: number) {
  const parametros = new URLSearchParams({
    data,
    pagamento,
    pagina: String(pagina),
  });

  return `/admin/pdv/historico?${parametros.toString()}`;
}

async function carregarVendasDoDia(dataSelecionada: string) {
  const inicio = `${dataSelecionada}T00:00:00-03:00`;
  const fim = `${diaSeguinte(dataSelecionada)}T00:00:00-03:00`;

  const vendas: Venda[] = [];
  let resultadoParcial = false;

  for (let bloco = 0; bloco < MAXIMO_CONSULTAS; bloco++) {
    const inicioBloco = bloco * LIMITE_CONSULTA;

    const { data, error } = await supabaseAdmin
      .from("pdv_vendas")
      .select(
        `
        id,
        created_at,
        cliente_id,
        forma_pagamento,
        subtotal,
        taxa_cartao,
        total,
        status
        `,
      )
      .gte("created_at", inicio)
      .lt("created_at", fim)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(inicioBloco, inicioBloco + LIMITE_CONSULTA - 1);

    if (error) {
      console.error("Erro ao consultar histórico do PDV:", error);
      throw new Error("ERRO_AO_CONSULTAR_HISTORICO");
    }

    const lote = (data ?? []) as Venda[];

    vendas.push(...lote);

    if (lote.length < LIMITE_CONSULTA) {
      break;
    }

    if (bloco === MAXIMO_CONSULTAS - 1) {
      resultadoParcial = true;
    }
  }

  return { vendas, resultadoParcial };
}

export default async function HistoricoPdvPage({
  searchParams,
}: {
  searchParams: Promise<Parametros>;
}) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const parametros = await searchParams;

  const dataRecebida = primeiroParametro(parametros.data);
  const dataSelecionada =
    dataRecebida && dataValida(dataRecebida) ? dataRecebida : dataHojeBrasil();

  const pagamentoRecebido = primeiroParametro(parametros.pagamento) ?? "todos";

  const pagamentoSelecionado =
    pagamentoRecebido === "todos" ||
    FORMAS.some((forma) => forma.id === pagamentoRecebido)
      ? pagamentoRecebido
      : "todos";

  const paginaRecebida = Number(primeiroParametro(parametros.pagina) ?? "1");

  const paginaDesejada =
    Number.isSafeInteger(paginaRecebida) && paginaRecebida > 0
      ? paginaRecebida
      : 1;

  let vendas: Venda[] = [];
  let resultadoParcial = false;
  let erroConsulta = false;

  try {
    const resultado = await carregarVendasDoDia(dataSelecionada);

    vendas = resultado.vendas;
    resultadoParcial = resultado.resultadoParcial;
  } catch {
    erroConsulta = true;
  }

  // Somente vendas concluídas entram nos valores do caixa.
  const vendasConcluidas = vendas.filter(
    (venda) => venda.status === "concluida",
  );

  const vendasCanceladas = vendas.filter(
    (venda) => venda.status === "cancelada",
  );

  const totalDoDia = somarValores(
    vendasConcluidas.map((venda) => Number(venda.total)),
  );

  const ticketMedio =
    vendasConcluidas.length > 0 ? totalDoDia / vendasConcluidas.length : 0;

  const valoresPorPagamento = FORMAS.map((forma) => {
    const vendasForma = vendasConcluidas.filter(
      (venda) => venda.forma_pagamento === forma.id,
    );

    return {
      ...forma,
      quantidade: vendasForma.length,
      total: somarValores(vendasForma.map((venda) => Number(venda.total))),
    };
  });

  const vendasFiltradas =
    pagamentoSelecionado === "todos"
      ? vendas
      : vendas.filter(
          (venda) => venda.forma_pagamento === pagamentoSelecionado,
        );

  const totalPaginas = Math.max(
    1,
    Math.ceil(vendasFiltradas.length / VENDAS_POR_PAGINA),
  );

  const paginaAtual = Math.min(paginaDesejada, totalPaginas);

  const inicioPagina = (paginaAtual - 1) * VENDAS_POR_PAGINA;

  const vendasPagina = vendasFiltradas.slice(
    inicioPagina,
    inicioPagina + VENDAS_POR_PAGINA,
  );

  // Carrega somente os detalhes das vendas exibidas.
  const idsVendas = vendasPagina.map((venda) => venda.id);

  const idsClientes = [
    ...new Set(
      vendasPagina
        .map((venda) => venda.cliente_id)
        .filter((id): id is number => id !== null),
    ),
  ];

  let itens: ItemVenda[] = [];
  let clientes: Cliente[] = [];
  let erroDetalhes = false;

  if (idsVendas.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("pdv_venda_itens")
      .select(
        "id, venda_id, nome_produto, preco_unitario, quantidade, subtotal",
      )
      .in("venda_id", idsVendas)
      .order("id", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("Erro ao consultar itens do PDV:", error);
      erroDetalhes = true;
    } else {
      itens = (data ?? []) as ItemVenda[];
    }
  }

  if (idsClientes.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("clientes")
      .select("id, nome")
      .in("id", idsClientes);

    if (error) {
      console.error("Erro ao consultar clientes do PDV:", error);
      erroDetalhes = true;
    } else {
      clientes = (data ?? []) as Cliente[];
    }
  }

  const itensPorVenda = new Map<number, ItemVenda[]>();

  for (const item of itens) {
    const lista = itensPorVenda.get(item.venda_id) ?? [];

    lista.push(item);
    itensPorVenda.set(item.venda_id, lista);
  }

  const nomesClientes = new Map<number, string>(
    clientes.map((cliente) => [cliente.id, cliente.nome]),
  );

  return (
    <main className="min-h-screen bg-[#070707] px-4 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* CABEÇALHO */}
        <header className="flex flex-col justify-between gap-5 rounded-[28px] border border-white/10 bg-zinc-950 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Depósito do Zé
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Histórico de Vendas
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Consulte o movimento do caixa presencial.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/5"
            >
              Painel
            </Link>

            <Link
              href="/admin/pdv"
              className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black transition hover:bg-amber-300"
            >
              ← Voltar ao PDV
            </Link>
          </div>
        </header>

        {/* FILTROS */}
        <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-5">
          <form
            action="/admin/pdv/historico"
            method="GET"
            className="flex flex-col gap-4 md:flex-row md:items-end"
          >
            <div className="flex-1">
              <label
                htmlFor="data-historico"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-400"
              >
                Data das vendas
              </label>

              <input
                id="data-historico"
                type="date"
                name="data"
                defaultValue={dataSelecionada}
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 text-sm font-semibold text-white outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex-1">
              <label
                htmlFor="pagamento-historico"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-zinc-400"
              >
                Forma de pagamento
              </label>

              <select
                id="pagamento-historico"
                name="pagamento"
                defaultValue={pagamentoSelecionado}
                className="h-12 w-full rounded-xl border border-white/10 bg-zinc-900 px-4 text-sm font-semibold text-white outline-none focus:border-amber-400"
              >
                <option value="todos">Todos os pagamentos</option>

                {FORMAS.map((forma) => (
                  <option key={forma.id} value={forma.id}>
                    {forma.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="h-12 rounded-xl bg-amber-400 px-6 text-sm font-black text-black transition hover:bg-amber-300"
            >
              🔎 Consultar
            </button>

            <Link
              href="/admin/pdv/historico"
              className="flex h-12 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-bold text-zinc-300"
            >
              Hoje
            </Link>
          </form>
        </section>

        {erroConsulta ? (
          <section className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="font-black text-red-300">
              Não foi possível carregar o histórico.
            </h2>

            <p className="mt-2 text-sm text-red-200">
              Confira a conexão com o Supabase e tente novamente.
            </p>
          </section>
        ) : (
          <>
            {/* RESUMO DO DIA */}
            <section className="mt-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Resumo do dia</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {formatarData(dataSelecionada)}
                  </p>
                </div>

                <p className="text-xs text-zinc-500">Horários de Brasília</p>
              </div>

              {resultadoParcial && (
                <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">
                  O movimento ultrapassou o limite de consulta. Os valores
                  abaixo são parciais.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Total vendido
                  </p>

                  <p className="mt-3 text-3xl font-black text-white">
                    {dinheiro(totalDoDia)}
                  </p>

                  <p className="mt-2 text-xs text-zinc-400">
                    Vendas concluídas
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Vendas concluídas
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {vendasConcluidas.length}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Operações registradas
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Ticket médio
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {dinheiro(ticketMedio)}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Média por venda concluída
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                    Cancelamentos
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {vendasCanceladas.length}
                  </p>

                  <p className="mt-2 text-xs text-zinc-500">
                    Excluídos do total vendido
                  </p>
                </div>
              </div>
            </section>

            {/* TOTAIS POR PAGAMENTO */}
            <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-5">
              <div className="mb-5">
                <h2 className="text-lg font-black">
                  Recebimentos por forma de pagamento
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Resumo para conferência diária do caixa.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {valoresPorPagamento.map((forma) => (
                  <div
                    key={forma.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{forma.icone}</span>

                      <p className="text-sm font-black text-zinc-300">
                        {forma.nome}
                      </p>
                    </div>

                    <p className="mt-4 text-2xl font-black text-amber-400">
                      {dinheiro(forma.total)}
                    </p>

                    <p className="mt-2 text-xs text-zinc-500">
                      {forma.quantidade}{" "}
                      {forma.quantidade === 1 ? "venda" : "vendas"}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* HISTÓRICO DETALHADO */}
            <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">Vendas registradas</h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {vendasFiltradas.length} venda(s) no filtro selecionado
                  </p>
                </div>

                <span className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-zinc-400">
                  Página {paginaAtual} de {totalPaginas}
                </span>
              </div>

              {erroDetalhes && (
                <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
                  Alguns detalhes de clientes ou produtos não puderam ser
                  carregados.
                </p>
              )}

              {vendasPagina.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 px-4 py-14 text-center">
                  <p className="text-4xl">🧾</p>

                  <p className="mt-3 font-black text-white">
                    Nenhuma venda encontrada
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    Ainda não há vendas do PDV para esses filtros.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {vendasPagina.map((venda) => {
                    const itensVenda = itensPorVenda.get(venda.id) ?? [];

                    const cliente =
                      venda.cliente_id !== null
                        ? nomesClientes.get(venda.cliente_id)
                        : null;

                    const cancelada = venda.status === "cancelada";

                    return (
                      <article
                        key={venda.id}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"
                      >
                        <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-center">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-black">
                                Venda #{venda.id}
                              </p>

                              <span
                                className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${
                                  cancelada
                                    ? "bg-red-500/10 text-red-300"
                                    : venda.status === "concluida"
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : "bg-zinc-700 text-zinc-200"
                                }`}
                              >
                                {cancelada
                                  ? "Cancelada"
                                  : venda.status === "concluida"
                                    ? "Concluída"
                                    : venda.status}
                              </span>
                            </div>

                            <p className="mt-2 text-xs text-zinc-400">
                              {formatarData(dataSelecionada)}
                              {" • "}
                              {horarioBrasil(venda.created_at)}
                              {" • "}
                              {rotuloPagamento(venda.forma_pagamento)}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              Cliente:{" "}
                              {cliente ?? "Consumidor não identificado"}
                            </p>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-xs font-bold uppercase text-zinc-500">
                              Total
                            </p>

                            <p
                              className={`mt-1 text-2xl font-black ${
                                cancelada
                                  ? "text-zinc-500 line-through"
                                  : "text-amber-400"
                              }`}
                            >
                              {dinheiro(venda.total)}
                            </p>
                          </div>
                        </div>

                        <div className="p-4">
                          <p className="mb-3 text-xs font-black uppercase tracking-wider text-zinc-500">
                            Produtos vendidos
                          </p>

                          {itensVenda.length === 0 ? (
                            <p className="text-sm text-zinc-500">
                              Detalhes não disponíveis.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {itensVenda.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-start justify-between gap-3 text-sm"
                                >
                                  <div>
                                    <p className="font-semibold text-zinc-200">
                                      {item.nome_produto}
                                    </p>

                                    <p className="mt-1 text-xs text-zinc-500">
                                      {item.quantidade} ×{" "}
                                      {dinheiro(item.preco_unitario)}
                                    </p>
                                  </div>

                                  <strong className="shrink-0 text-zinc-200">
                                    {dinheiro(item.subtotal)}
                                  </strong>
                                </div>
                              ))}
                            </div>
                          )}

                          {Number(venda.taxa_cartao) > 0 && (
                            <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-xs text-zinc-400">
                              <span>Taxa de cartão</span>
                              <span>{dinheiro(venda.taxa_cartao)}</span>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* PAGINAÇÃO */}
              {totalPaginas > 1 && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {paginaAtual > 1 && (
                    <Link
                      href={linkPagina(
                        dataSelecionada,
                        pagamentoSelecionado,
                        paginaAtual - 1,
                      )}
                      className="rounded-xl border border-white/10 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200"
                    >
                      ← Anterior
                    </Link>
                  )}

                  <span className="px-3 text-sm font-semibold text-zinc-400">
                    {paginaAtual} / {totalPaginas}
                  </span>

                  {paginaAtual < totalPaginas && (
                    <Link
                      href={linkPagina(
                        dataSelecionada,
                        pagamentoSelecionado,
                        paginaAtual + 1,
                      )}
                      className="rounded-xl border border-white/10 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-200"
                    >
                      Próxima →
                    </Link>
                  )}
                </div>
              )}
            </section>

            <p className="mt-5 pb-8 text-center text-xs leading-5 text-zinc-500">
              Os valores representam vendas registradas como concluídas no PDV.
              Este resumo não substitui a conferência física do dinheiro e dos
              extratos bancários. Abertura, sangria e fechamento formal de caixa
              serão implementados separadamente.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

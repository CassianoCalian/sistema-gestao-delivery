"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  PdvCategoria,
  PdvCliente,
  PdvProduto,
} from "../../app/admin/pdv/page";

type Props = {
  produtos: PdvProduto[];
  categorias: PdvCategoria[];
  clientes: PdvCliente[];
};

type ItemCarrinho = {
  id: number;
  nome: string;
  preco: number;
  quantidade: number;
  estoque: number;
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function precoAtual(produto: PdvProduto) {
  if (produto.em_promocao && produto.preco_promocional !== null) {
    return produto.preco_promocional;
  }

  return produto.preco;
}

export default function PdvClient({ produtos, categorias, clientes }: Props) {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<number | null>(null);

  const [tipoAtendimento, setTipoAtendimento] = useState<"balcao" | "entrega">(
    "balcao",
  );

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [aviso, setAviso] = useState("");

  const [clientesDisponiveis, setClientesDisponiveis] =
    useState<PdvCliente[]>(clientes);

  const [clienteSelecionado, setClienteSelecionado] =
    useState<PdvCliente | null>(null);

  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  const [modoNovoCliente, setModoNovoCliente] = useState(false);

  const [buscaCliente, setBuscaCliente] = useState("");

  const [novoClienteNome, setNovoClienteNome] = useState("");

  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");

  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const [erroCliente, setErroCliente] = useState("");

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return produtos.filter((produto) => {
      if (categoria !== null && produto.categoria_id !== categoria) {
        return false;
      }

      if (!termo) {
        return true;
      }

      return (
        produto.nome.toLowerCase().includes(termo) ||
        produto.codigo_barras?.toLowerCase().includes(termo)
      );
    });
  }, [produtos, busca, categoria]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    const numeros = buscaCliente.replace(/\D/g, "");

    return clientesDisponiveis.filter((cliente) => {
      if (!termo && !numeros) {
        return true;
      }

      const nomeCombina = cliente.nome.toLowerCase().includes(termo);

      const telefoneCliente = (
        cliente.telefone_normalizado ?? cliente.telefone
      ).replace(/\D/g, "");

      const telefoneCombina =
        numeros.length > 0 && telefoneCliente.includes(numeros);

      return nomeCombina || telefoneCombina;
    });
  }, [clientesDisponiveis, buscaCliente]);

  const quantidadeItens = carrinho.reduce(
    (total, item) => total + item.quantidade,
    0,
  );

  const subtotal = carrinho.reduce(
    (total, item) => total + item.preco * item.quantidade,
    0,
  );

  function adicionarProduto(produto: PdvProduto) {
    setAviso("");

    if (produto.estoque <= 0) {
      setAviso(`${produto.nome} está sem estoque.`);

      return;
    }

    if (produto.unidades_por_item > 0 && produto.opcoes.length > 0) {
      setAviso(
        `${produto.nome} possui sabores/opções. Vamos habilitar a seleção na próxima etapa.`,
      );

      return;
    }

    setCarrinho((estadoAtual) => {
      const existente = estadoAtual.find((item) => item.id === produto.id);

      if (existente) {
        if (existente.quantidade >= produto.estoque) {
          setAviso(`Você atingiu o estoque disponível de ${produto.nome}.`);

          return estadoAtual;
        }

        return estadoAtual.map((item) =>
          item.id === produto.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
              }
            : item,
        );
      }

      return [
        ...estadoAtual,
        {
          id: produto.id,
          nome: produto.nome,
          preco: precoAtual(produto),
          quantidade: 1,
          estoque: produto.estoque,
        },
      ];
    });
  }

  function alterarQuantidade(id: number, alteracao: 1 | -1) {
    setCarrinho((estadoAtual) =>
      estadoAtual.map((item) => {
        if (item.id !== id) {
          return item;
        }

        return {
          ...item,

          quantidade: Math.min(
            item.estoque,
            Math.max(1, item.quantidade + alteracao),
          ),
        };
      }),
    );
  }

  function removerProduto(id: number) {
    setCarrinho((estadoAtual) => estadoAtual.filter((item) => item.id !== id));
  }

  function abrirSelecaoCliente() {
    setModoNovoCliente(false);
    setBuscaCliente("");
    setErroCliente("");
    setModalClienteAberto(true);
  }

  function selecionarCliente(cliente: PdvCliente) {
    setClienteSelecionado(cliente);
    setModalClienteAberto(false);
    setBuscaCliente("");
    setErroCliente("");
  }

  return (
    <div className="mt-6">
      {/* CABEÇALHO */}
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-[100px]"
        />

        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-amber-400/30 bg-amber-400/10 text-3xl">
              🧾
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                Operação de venda
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                PDV • Depósito do Zé
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                Balcão e delivery usando o mesmo estoque.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            ← Painel
          </button>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-zinc-200 transition hover:border-amber-400/40 hover:bg-amber-400/5"
            >
              👤 Novo cliente
            </button>

            <button
              type="button"
              className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-black text-zinc-200 transition hover:border-amber-400/40 hover:bg-amber-400/5"
            >
              💳 Pagamentos
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/produtos/novo")}
              className="h-12 rounded-2xl bg-amber-400 px-5 text-sm font-black text-black transition hover:bg-amber-300"
            >
              + Novo produto
            </button>
          </div>
        </div>
      </section>

      {/* AVISO */}
      {aviso && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
          <p className="text-sm font-bold text-amber-200">{aviso}</p>

          <button
            type="button"
            onClick={() => setAviso("")}
            className="text-lg text-amber-300"
          >
            ×
          </button>
        </div>
      )}

      {/* CORPO DO PDV */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* CATÁLOGO */}
        <section className="min-w-0 rounded-[30px] border border-white/10 bg-[#0d0d0f] p-5 shadow-2xl">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl">
                🔎
              </span>

              <input
                type="text"
                autoFocus
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar produto ou código de barras..."
                className="h-14 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-4 text-base font-semibold text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/50"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setBusca("");
                setCategoria(null);
              }}
              className="h-14 rounded-2xl border border-white/10 bg-zinc-900 px-5 text-sm font-black text-zinc-300 transition hover:border-white/20"
            >
              Limpar filtros
            </button>
          </div>

          {/* CATEGORIAS */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setCategoria(null)}
              className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black transition ${
                categoria === null
                  ? "bg-amber-400 text-black"
                  : "border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white"
              }`}
            >
              Todos
            </button>

            {categorias.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategoria(item.id)}
                className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black transition ${
                  categoria === item.id
                    ? "bg-amber-400 text-black"
                    : "border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white"
                }`}
              >
                {item.nome}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-lg font-black text-white">Produtos</p>

              <p className="mt-1 text-sm text-zinc-500">
                {produtosFiltrados.length} produto(s) encontrado(s)
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-400">
              ▥ Código de barras
            </div>
          </div>

          {/* PRODUTOS */}
          {produtosFiltrados.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-4xl">🔎</p>

              <p className="mt-3 font-black text-white">
                Nenhum produto encontrado
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
              {produtosFiltrados.map((produto) => {
                const valor = precoAtual(produto);

                const temOpcoes =
                  produto.unidades_por_item > 0 && produto.opcoes.length > 0;

                return (
                  <button
                    key={produto.id}
                    type="button"
                    onClick={() => adicionarProduto(produto)}
                    className="group relative overflow-hidden rounded-[22px] border border-white/10 bg-zinc-900 text-left transition duration-200 hover:-translate-y-1 hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-400/5"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-black/30">
                      {produto.imagem_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={produto.imagem_url}
                          alt={produto.nome}
                          className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-5xl">
                          🍺
                        </div>
                      )}

                      {produto.em_promocao && (
                        <span className="absolute left-2 top-2 rounded-lg bg-red-500 px-2 py-1 text-[10px] font-black uppercase text-white">
                          Promo
                        </span>
                      )}

                      {temOpcoes && (
                        <span className="absolute bottom-2 left-2 rounded-lg bg-amber-400 px-2 py-1 text-[10px] font-black text-black">
                          Sabores
                        </span>
                      )}
                    </div>

                    <div className="p-3">
                      <p className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-white">
                        {produto.nome}
                      </p>

                      <div className="mt-3 flex items-end justify-between gap-2">
                        <div>
                          {produto.em_promocao &&
                            produto.preco_promocional !== null && (
                              <p className="text-[11px] text-zinc-600 line-through">
                                {formatarPreco(produto.preco)}
                              </p>
                            )}

                          <p className="text-lg font-black text-amber-400">
                            {formatarPreco(valor)}
                          </p>
                        </div>

                        <span
                          className={`rounded-lg px-2 py-1 text-[10px] font-black ${
                            produto.estoque === 0
                              ? "bg-red-500/10 text-red-300"
                              : produto.estoque <= 5
                                ? "bg-orange-500/10 text-orange-300"
                                : "bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {produto.estoque} un.
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* LADO DIREITO */}
        <aside className="xl:sticky xl:top-5 xl:self-start">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#101012] shadow-2xl">
            {/* TIPO */}
            <div className="border-b border-white/10 p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
                Tipo de atendimento
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoAtendimento("balcao")}
                  className={`h-14 rounded-2xl text-sm font-black transition ${
                    tipoAtendimento === "balcao"
                      ? "bg-amber-400 text-black"
                      : "border border-white/10 bg-black/30 text-zinc-400"
                  }`}
                >
                  🏪 Balcão
                </button>

                <button
                  type="button"
                  onClick={() => setTipoAtendimento("entrega")}
                  className={`h-14 rounded-2xl text-sm font-black transition ${
                    tipoAtendimento === "entrega"
                      ? "bg-amber-400 text-black"
                      : "border border-white/10 bg-black/30 text-zinc-400"
                  }`}
                >
                  🛵 Entrega
                </button>
              </div>
            </div>

            {/* CARRINHO */}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-white">Venda atual</p>

                  <p className="mt-1 text-xs text-zinc-500">
                    {quantidadeItens} {quantidadeItens === 1 ? "item" : "itens"}
                  </p>
                </div>

                {carrinho.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCarrinho([])}
                    className="text-xs font-bold text-red-300 transition hover:text-red-200"
                  >
                    Limpar venda
                  </button>
                )}
              </div>

              {carrinho.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
                  <div className="text-4xl">🛒</div>

                  <p className="mt-3 font-black text-zinc-300">Venda vazia</p>

                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    Selecione um produto no catálogo.
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">
                            {item.nome}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {formatarPreco(item.preco)} cada
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removerProduto(item.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={item.quantidade <= 1}
                            onClick={() => alterarQuantidade(item.id, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-lg font-black disabled:opacity-30"
                          >
                            −
                          </button>

                          <strong className="min-w-8 text-center text-lg">
                            {item.quantidade}
                          </strong>

                          <button
                            type="button"
                            disabled={item.quantidade >= item.estoque}
                            onClick={() => alterarQuantidade(item.id, 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-black disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <strong className="text-base font-black text-amber-400">
                          {formatarPreco(item.preco * item.quantidade)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CLIENTE E PAGAMENTO */}
            <div className="border-t border-white/10 bg-black/20 p-5">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-400/30 onClick={abrirSelecaoCliente}"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Cliente
                  </p>

                  <p className="mt-1 text-sm font-black text-white">
                    {clienteSelecionado
                      ? clienteSelecionado.nome
                      : tipoAtendimento === "balcao"
                        ? "Consumidor não identificado"
                        : "Selecionar cliente da entrega"}
                  </p>

                  {clienteSelecionado && (
                    <p className="mt-1 text-xs font-semibold text-zinc-500">
                      {clienteSelecionado.telefone}
                    </p>
                  )}
                </div>

                <span className="text-xl font-black text-amber-400">+</span>
              </button>

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-amber-400/30"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Pagamento
                  </p>

                  <p className="mt-1 text-sm font-black text-white">
                    Selecionar forma de pagamento
                  </p>
                </div>

                <span className="text-xl text-amber-400">›</span>
              </button>

              {/* TOTAL */}
              <div className="mt-5 border-t border-white/10 pt-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
                      Total da venda
                    </p>

                    <p className="mt-1 text-4xl font-black tracking-tight text-white">
                      {formatarPreco(subtotal)}
                    </p>
                  </div>

                  <span
                    className={`rounded-xl px-3 py-2 text-xs font-black ${
                      tipoAtendimento === "balcao"
                        ? "bg-amber-400/10 text-amber-300"
                        : "bg-blue-500/10 text-blue-300"
                    }`}
                  >
                    {tipoAtendimento === "balcao" ? "BALCÃO" : "ENTREGA"}
                  </span>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-5 h-14 w-full cursor-not-allowed rounded-2xl bg-emerald-500 text-base font-black text-black opacity-40"
                >
                  Finalizar venda
                </button>

                <p className="mt-2 text-center text-xs text-zinc-600">
                  Finalização será ativada depois de configurarmos cliente e
                  pagamento.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Produto = {
  id: number;
  nome: string;
  estoque: number;
  ativo: boolean;
};

type EntradaEstoqueFormProps = {
  produtos: Produto[];
  produtoInicialId?: number;
};

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function EntradaEstoqueForm({
  produtos,
  produtoInicialId,
}: EntradaEstoqueFormProps) {
  const router = useRouter();
  const buscaRef = useRef<HTMLDivElement>(null);

  const produtoInicial = produtos.find(
    (produto) => produto.id === produtoInicialId,
  );

  const [produtoId, setProdutoId] = useState(
    produtoInicial ? String(produtoInicial.id) : "",
  );

  const [busca, setBusca] = useState(produtoInicial?.nome ?? "");
  const [listaAberta, setListaAberta] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const produtosEncontrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);

    return produtos.filter((produto) => {
      const nome = normalizar(produto.nome);
      return termos.every((termo) => nome.includes(termo));
    });
  }, [produtos, busca]);

  const produtosVisiveis = produtosEncontrados.slice(0, 12);

  const produtoSelecionado = produtos.find(
    (produto) => String(produto.id) === produtoId,
  );

  useEffect(() => {
    function fecharAoClicarFora(event: MouseEvent) {
      if (
        buscaRef.current &&
        !buscaRef.current.contains(event.target as Node)
      ) {
        setListaAberta(false);
      }
    }

    document.addEventListener("mousedown", fecharAoClicarFora);

    return () => {
      document.removeEventListener("mousedown", fecharAoClicarFora);
    };
  }, []);

  function selecionarProduto(produto: Produto) {
    setProdutoId(String(produto.id));
    setBusca(produto.nome);
    setListaAberta(false);
    setIndiceAtivo(0);
    setErro("");
  }

  function alterarBusca(valor: string) {
    setBusca(valor);
    setProdutoId("");
    setIndiceAtivo(0);
    setListaAberta(true);
    setErro("");
  }

  function controlarTeclado(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setListaAberta(false);
      return;
    }

    if (!listaAberta) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setListaAberta(true);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndiceAtivo((atual) =>
        Math.min(atual + 1, produtosVisiveis.length - 1),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndiceAtivo((atual) => Math.max(0, atual - 1));
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const produto = produtosVisiveis[indiceAtivo];

      if (produto) {
        selecionarProduto(produto);
      }
    }
  }

  async function registrarEntrada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    const quantidadeNumero = Number(quantidade);

    if (!produtoId) {
      setErro("Pesquise e selecione um produto da lista.");
      return;
    }

    if (!Number.isInteger(quantidadeNumero) || quantidadeNumero <= 0) {
      setErro("Informe uma quantidade válida.");
      return;
    }

    setEnviando(true);

    try {
      const resposta = await fetch("/api/admin/estoque/entrada", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          produto_id: Number(produtoId),
          quantidade: quantidadeNumero,
          observacao,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        setErro(resultado.erro ?? "Não foi possível registrar a entrada.");
        return;
      }

      setSucesso(
        `Entrada registrada! Estoque: ${resultado.estoque_anterior} → ${resultado.estoque_novo}.`,
      );

      setQuantidade("");
      setObservacao("");
      router.refresh();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Erro ao registrar entrada:", error);
      }

      setErro("Não foi possível registrar a entrada.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={registrarEntrada}
      className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
    >
      <div className="grid gap-5 md:grid-cols-2">
        {/* BUSCA INTELIGENTE DE PRODUTOS */}
        <div ref={buscaRef} className="relative">
          <label htmlFor="produto" className="text-sm font-black text-white">
            Produto
          </label>

          <div className="relative mt-2">
            <input
              id="produto"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={listaAberta}
              aria-controls="lista-produtos-estoque"
              aria-activedescendant={
                listaAberta && produtosVisiveis[indiceAtivo]
                  ? `produto-opcao-${produtosVisiveis[indiceAtivo].id}`
                  : undefined
              }
              autoComplete="off"
              placeholder="🔎 Digite o nome do produto..."
              value={busca}
              disabled={enviando}
              onFocus={() => {
                setIndiceAtivo(0);
                setListaAberta(true);
              }}
              onChange={(event) => alterarBusca(event.target.value)}
              onKeyDown={controlarTeclado}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-12 text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400"
            />

            {busca && (
              <button
                type="button"
                aria-label="Limpar produto"
                onClick={() => {
                  alterarBusca("");
                  document.getElementById("produto")?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {listaAberta && (
            <div
              id="lista-produtos-estoque"
              role="listbox"
              aria-label="Produtos encontrados"
              className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
            >
              {produtosVisiveis.length > 0 ? (
                <>
                  {produtosVisiveis.map((produto, index) => (
                    <button
                      key={produto.id}
                      id={`produto-opcao-${produto.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === indiceAtivo}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selecionarProduto(produto)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 text-left transition last:border-b-0 ${
                        index === indiceAtivo
                          ? "bg-amber-400/15"
                          : "hover:bg-zinc-800"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">
                          {produto.nome}
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">
                          Estoque atual: {produto.estoque}
                          {!produto.ativo && (
                            <span className="ml-2 text-red-400">• Inativo</span>
                          )}
                        </p>
                      </div>

                      <span className="shrink-0 text-amber-400">
                        {index === indiceAtivo ? "✓" : "→"}
                      </span>
                    </button>
                  ))}

                  {produtosEncontrados.length > 12 && (
                    <p className="px-4 py-3 text-center text-xs text-zinc-400">
                      Mostrando 12 de {produtosEncontrados.length} produtos.
                      Digite mais para refinar a busca.
                    </p>
                  )}
                </>
              ) : (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm font-bold text-zinc-300">
                    Nenhum produto encontrado
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Tente outro nome ou parte dele.
                  </p>
                </div>
              )}
            </div>
          )}

          {produtoSelecionado && (
            <p className="mt-2 text-xs font-bold text-green-400">
              ✓ Produto selecionado: {produtoSelecionado.nome}
            </p>
          )}
        </div>

        {/* QUANTIDADE RECEBIDA */}
        <div>
          <label htmlFor="quantidade" className="text-sm font-black text-white">
            Quantidade recebida
          </label>

          <input
            id="quantidade"
            type="number"
            min="1"
            step="1"
            value={quantidade}
            disabled={enviando}
            onChange={(event) => setQuantidade(event.target.value)}
            placeholder="Ex.: 24"
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          />
        </div>
      </div>

      {/* PREVISÃO DE ESTOQUE */}
      {produtoSelecionado && (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Estoque
          </p>

          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-black">
              {produtoSelecionado.estoque}
            </span>

            {Number(quantidade) > 0 && (
              <>
                <span className="text-zinc-500">→</span>

                <span className="text-2xl font-black text-green-400">
                  {produtoSelecionado.estoque + Number(quantidade)}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* OBSERVAÇÃO */}
      <div className="mt-5">
        <label htmlFor="observacao" className="text-sm font-black text-white">
          Observação
        </label>

        <textarea
          id="observacao"
          rows={3}
          value={observacao}
          disabled={enviando}
          onChange={(event) => setObservacao(event.target.value)}
          placeholder="Ex.: Reposição do fornecedor, 4 fardos, NF 12345..."
          className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
        />
      </div>

      {/* MENSAGENS */}
      {erro && (
        <div className="mt-5 rounded-xl border border-red-900 bg-red-950/30 p-4 font-bold text-red-400">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="mt-5 rounded-xl border border-green-900 bg-green-950/30 p-4 font-bold text-green-400">
          ✅ {sucesso}
        </div>
      )}

      {/* REGISTRAR ENTRADA */}
      <button
        type="submit"
        disabled={enviando}
        className="mt-6 w-full rounded-xl bg-amber-400 px-6 py-4 font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviando
          ? "Registrando entrada..."
          : "📥 Registrar entrada de mercadoria"}
      </button>
    </form>
  );
}

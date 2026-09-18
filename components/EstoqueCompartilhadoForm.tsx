"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Produto = {
  id: number;
  nome: string;
  ativo: boolean;
  estoque_compartilhado_id: number | null;
  estoque_compartilhado_nome: string | null;
};

type Vinculo = {
  produto_id: number;
  quantidade_por_venda: number;
};

type Estoque = {
  id: number;
  nome: string;
  quantidade_total: number;
  vinculos: Vinculo[];
};

type Props = {
  produtos: Produto[];
  estoques: Estoque[];
};

export default function EstoqueCompartilhadoForm({
  produtos,
  estoques,
}: Props) {
  const router = useRouter();

  const [estoqueId, setEstoqueId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [quantidadeTotal, setQuantidadeTotal] = useState("0");

  const [vinculos, setVinculos] = useState<Record<number, number>>({});

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  function novoEstoque() {
    setEstoqueId(null);
    setNome("");
    setQuantidadeTotal("0");
    setVinculos({});
    setErro("");
    setSucesso("");
  }

  function editarEstoque(estoque: Estoque) {
    setEstoqueId(estoque.id);
    setNome(estoque.nome);
    setQuantidadeTotal(String(estoque.quantidade_total));

    const novosVinculos: Record<number, number> = {};

    for (const vinculo of estoque.vinculos) {
      novosVinculos[vinculo.produto_id] = vinculo.quantidade_por_venda;
    }

    setVinculos(novosVinculos);
    setErro("");
    setSucesso("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function produtoBloqueado(produto: Produto) {
    return (
      produto.estoque_compartilhado_id !== null &&
      produto.estoque_compartilhado_id !== estoqueId
    );
  }

  function alternarProduto(produto: Produto) {
    if (produtoBloqueado(produto)) {
      return;
    }

    setVinculos((atual) => {
      const proximo = { ...atual };

      if (produto.id in proximo) {
        delete proximo[produto.id];
      } else {
        proximo[produto.id] = 1;
      }

      return proximo;
    });
  }

  function alterarConsumo(produtoId: number, valor: number) {
    setVinculos((atual) => ({
      ...atual,
      [produtoId]: valor,
    }));
  }

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    const quantidade = Number(quantidadeTotal);

    if (!nome.trim()) {
      setErro("Informe o nome do estoque físico.");
      return;
    }

    if (!Number.isInteger(quantidade) || quantidade < 0) {
      setErro("Informe uma quantidade física válida.");
      return;
    }

    const vinculosPayload = Object.entries(vinculos).map(
      ([produtoId, consumo]) => ({
        produto_id: Number(produtoId),
        quantidade_por_venda: Number(consumo),
      }),
    );

    if (vinculosPayload.length === 0) {
      setErro("Vincule pelo menos um produto a este estoque.");
      return;
    }

    if (
      vinculosPayload.some(
        (vinculo) =>
          !Number.isInteger(vinculo.quantidade_por_venda) ||
          vinculo.quantidade_por_venda <= 0,
      )
    ) {
      setErro(
        "A quantidade consumida por venda deve ser um número inteiro maior que zero.",
      );
      return;
    }

    setEnviando(true);

    try {
      const resposta = await fetch("/api/admin/estoque/compartilhado", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          estoque_id: estoqueId,
          nome: nome.trim(),
          quantidade_total: quantidade,
          vinculos: vinculosPayload,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        setErro(resultado.erro ?? "Não foi possível salvar o estoque físico.");
        return;
      }

      setSucesso(
        estoqueId
          ? "Estoque físico atualizado com sucesso."
          : "Estoque físico criado com sucesso.",
      );

      router.refresh();
    } catch (error) {
      console.error("Erro ao salvar estoque compartilhado:", error);

      setErro("Não foi possível salvar o estoque físico.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_420px]">
      <form
        onSubmit={salvar}
        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-400">
              {estoqueId ? "Editar estoque" : "Novo estoque"}
            </p>

            <h2 className="mt-1 text-2xl font-black">
              Estoque físico compartilhado
            </h2>
          </div>

          {estoqueId && (
            <button
              type="button"
              onClick={novoEstoque}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:border-amber-400 hover:text-amber-400"
            >
              + Novo estoque
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-sm font-black">Nome do estoque físico</label>

            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: BRAHMA 473ML GELADA"
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
            />
          </div>

          <div>
            <label className="text-sm font-black">
              Quantidade física total
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={quantidadeTotal}
              onChange={(event) => setQuantidadeTotal(event.target.value)}
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
            />

            <p className="mt-2 text-xs text-zinc-500">
              Quantidade real de unidades. Ex.: 240 latões.
            </p>
          </div>
        </div>

        <div className="mt-8">
          <p className="font-black">Produtos ligados a este estoque</p>

          <p className="mt-1 text-sm text-zinc-400">
            Marque os formatos de venda e informe quantas unidades físicas cada
            venda consome.
          </p>

          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
            {produtos.map((produto) => {
              const selecionado = produto.id in vinculos;
              const bloqueado = produtoBloqueado(produto);

              return (
                <div
                  key={produto.id}
                  className={`rounded-xl border p-4 ${
                    selecionado
                      ? "border-amber-400/50 bg-amber-400/5"
                      : "border-zinc-800 bg-zinc-950"
                  } ${bloqueado ? "opacity-50" : ""}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label
                      className={`flex items-center gap-3 ${
                        bloqueado ? "cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={bloqueado}
                        checked={selecionado}
                        onChange={() => alternarProduto(produto)}
                        className="h-4 w-4 accent-amber-400"
                      />

                      <span>
                        <span className="block font-bold">{produto.nome}</span>

                        {!produto.ativo && (
                          <span className="block text-xs text-red-400">
                            Produto inativo
                          </span>
                        )}

                        {bloqueado && (
                          <span className="block text-xs text-orange-400">
                            Já pertence a: {produto.estoque_compartilhado_nome}
                          </span>
                        )}
                      </span>
                    </label>

                    {selecionado && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500">
                          Consome
                        </span>

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={vinculos[produto.id]}
                          onChange={(event) =>
                            alterarConsumo(
                              produto.id,
                              Number(event.target.value),
                            )
                          }
                          className="w-20 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center font-black outline-none focus:border-amber-400"
                        />

                        <span className="text-xs text-zinc-500">un.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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

        <button
          type="submit"
          disabled={enviando}
          className="mt-6 w-full rounded-xl bg-amber-400 px-6 py-4 font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando
            ? "Salvando..."
            : estoqueId
              ? "Salvar alterações"
              : "Criar estoque físico"}
        </button>
      </form>

      <aside className="space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-amber-400">
            Estoques cadastrados
          </p>

          <p className="mt-1 text-sm text-zinc-400">
            Clique em um estoque para editar.
          </p>
        </div>

        {estoques.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-400">
            Nenhum estoque compartilhado cadastrado.
          </div>
        )}

        {estoques.map((estoque) => (
          <button
            type="button"
            key={estoque.id}
            onClick={() => editarEstoque(estoque)}
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-amber-400/60"
          >
            <p className="font-black">{estoque.nome}</p>

            <p className="mt-2 text-3xl font-black text-amber-400">
              {estoque.quantidade_total}
            </p>

            <p className="text-xs text-zinc-500">unidades físicas</p>

            <div className="mt-4 space-y-1 border-t border-zinc-800 pt-3">
              {estoque.vinculos.map((vinculo) => {
                const produto = produtos.find(
                  (item) => item.id === vinculo.produto_id,
                );

                return (
                  <p key={vinculo.produto_id} className="text-xs text-zinc-400">
                    {produto?.nome ?? `Produto #${vinculo.produto_id}`} →{" "}
                    {vinculo.quantidade_por_venda} un.
                  </p>
                );
              })}
            </div>
          </button>
        ))}
      </aside>
    </div>
  );
}

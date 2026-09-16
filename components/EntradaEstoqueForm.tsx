"use client";

import { FormEvent, useState } from "react";
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

export default function EntradaEstoqueForm({
  produtos,
  produtoInicialId,
}: EntradaEstoqueFormProps) {
  const router = useRouter();

  const [produtoId, setProdutoId] = useState(() => {
    if (!produtoInicialId) {
      return "";
    }

    const produtoExiste = produtos.some(
      (produto) => produto.id === produtoInicialId,
    );

    return produtoExiste ? String(produtoInicialId) : "";
  });
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const produtoSelecionado = produtos.find(
    (produto) => produto.id === Number(produtoId),
  );

  async function registrarEntrada(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    const quantidadeNumero = Number(quantidade);

    if (!produtoId) {
      setErro("Selecione um produto.");
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
        <div>
          <label htmlFor="produto" className="text-sm font-black text-white">
            Produto
          </label>

          <select
            id="produto"
            value={produtoId}
            onChange={(event) => setProdutoId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">Selecione um produto</option>

            {produtos.map((produto) => (
              <option key={produto.id} value={produto.id}>
                {produto.nome} — estoque atual: {produto.estoque}
                {!produto.ativo ? " — inativo" : ""}
              </option>
            ))}
          </select>
        </div>

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
            onChange={(event) => setQuantidade(event.target.value)}
            placeholder="Ex.: 24"
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          />
        </div>
      </div>

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

      <div className="mt-5">
        <label htmlFor="observacao" className="text-sm font-black text-white">
          Observação
        </label>

        <textarea
          id="observacao"
          rows={3}
          value={observacao}
          onChange={(event) => setObservacao(event.target.value)}
          placeholder="Ex.: Reposição do fornecedor, 4 fardos, NF 12345..."
          className="mt-2 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
        />
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
          ? "Registrando entrada..."
          : "📥 Registrar entrada de mercadoria"}
      </button>
    </form>
  );
}

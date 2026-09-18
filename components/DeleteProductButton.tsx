"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteProductButtonProps = {
  produtoId: number;
  produtoNome: string;
};

export default function DeleteProductButton({
  produtoId,
  produtoNome,
}: DeleteProductButtonProps) {
  const router = useRouter();

  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  async function excluirProduto() {
    const confirmou = window.confirm(
      `Tem certeza que deseja excluir "${produtoNome}"?\n\nO produto deixará de aparecer na loja.`,
    );

    if (!confirmou) {
      return;
    }

    setExcluindo(true);
    setErro("");

    try {
      const resposta = await fetch(`/api/admin/produtos/${produtoId}`, {
        method: "DELETE",
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Não foi possível excluir o produto.");
      }

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o produto.",
      );
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={excluirProduto}
        disabled={excluindo}
        className="w-full rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-sm font-bold text-red-300 transition hover:border-red-400/40 hover:bg-red-500/[0.12] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {excluindo ? "Excluindo..." : "🗑️ Excluir produto"}
      </button>

      {erro && (
        <p className="mt-2 text-center text-xs font-bold text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}

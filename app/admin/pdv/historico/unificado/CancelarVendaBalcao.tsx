"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelarVendaBalcao({
  id,
  total,
}: {
  id: number;
  total: number;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function cancelar() {
    const motivo = window.prompt(
      `Motivo do cancelamento da venda #${id}:`
    );

    if (motivo === null) return;

    if (motivo.trim().length < 5) {
      setErro("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }

    const confirmou = window.confirm(
      `CANCELAR VENDA #${id}\n` +
      `Valor: R$ ${total.toFixed(2)}\n\n` +
      "Confirme SOMENTE se o dinheiro ja foi devolvido " +
      "ou o Pix/cartao ja foi estornado.\n\n" +
      "O estoque sera reposto e a venda saira do faturamento. " +
      "Nao sera possivel desfazer."
    );

    if (!confirmou) return;

    setOcupado(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/admin/pdv/vendas/cancelar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            venda_id: id,
            motivo: motivo.trim(),
            reembolso_confirmado: true,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro ?? "Cancelamento falhou.");
      }

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Falha no cancelamento."
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void cancelar()}
        className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
      >
        {ocupado ? "Cancelando..." : "Cancelar venda"}
      </button>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {erro}
        </p>
      )}
    </div>
  );
}
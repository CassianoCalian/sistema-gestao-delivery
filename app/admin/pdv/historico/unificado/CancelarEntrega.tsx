"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelarEntrega({ id, pago = false }: { id: number; pago?: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  async function cancelar() {
    const confirmou = window.confirm(
      `Cancelar o pedido de entrega #${id}?\n\n` +
      (pago
        ? "ATENCAO: o pagamento esta confirmado. So continue se o valor ja foi devolvido ao cliente.\n\n"
        : "Confira que o pagamento nao foi recebido.\n\n") +
      "O estoque sera reposto. O pedido ficara registrado como cancelado."
    );

    if (!confirmou) return;

    setEnviando(true);
    setErro("");

    try {
      const resposta = await fetch(`/api/pedidos/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelado" }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.erro ?? "Nao foi possivel cancelar."
        );
      }

      router.refresh();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Erro no cancelamento."
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={enviando}
        onClick={() => void cancelar()}
        className="rounded-lg border border-red-500/40 px-3 py-2 text-sm font-bold text-red-300 disabled:opacity-50"
      >
        {enviando ? "Cancelando..." : "Cancelar entrega"}
      </button>

      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {erro}
        </p>
      )}
    </div>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ConfirmPaymentButtonProps = {
  pedidoId: number;
  pagamentoConfirmado: boolean;
  statusAtual: string;
};

export default function ConfirmPaymentButton({
  pedidoId,
  pagamentoConfirmado,
  statusAtual,
}: ConfirmPaymentButtonProps) {
  const router = useRouter();

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const podeDesconfirmar =
    pagamentoConfirmado &&
    (statusAtual === "recebido" || statusAtual === "em_preparacao");

  const pagamentoTravado =
    pagamentoConfirmado &&
    (statusAtual === "saiu_entrega" || statusAtual === "entregue");

  const mensagemPagamentoTravado =
    statusAtual === "entregue"
      ? "Pagamento confirmado. O pedido já foi finalizado."
      : "A confirmação está bloqueada porque o pedido já saiu para entrega.";

  async function atualizarPagamento(novoValor: boolean) {
    if (statusAtual === "cancelado") {
      return;
    }

    if (!novoValor) {
      const confirmou = window.confirm(
        "Deseja realmente desfazer a confirmação deste pagamento PIX?",
      );

      if (!confirmou) {
        return;
      }
    }

    setErro("");
    setCarregando(true);

    try {
      const resposta = await fetch(`/api/pedidos/${pedidoId}/pagamento`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pagamento_confirmado: novoValor,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ?? "Não foi possível atualizar o pagamento.",
        );
      }

      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Erro ao atualizar pagamento.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-4">
      {!pagamentoConfirmado ? (
        <button
          type="button"
          onClick={() => atualizarPagamento(true)}
          disabled={carregando || statusAtual === "cancelado"}
          className="w-full rounded-xl bg-amber-400 px-5 py-3 font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {carregando ? "Atualizando..." : "💰 Confirmar pagamento"}
        </button>
      ) : (
        <div className="rounded-xl border border-green-800 bg-green-950/30 p-4">
          <p className="text-center font-black text-green-400">
            ✅ Pagamento confirmado
          </p>

          {pagamentoTravado && (
            <p className="mt-2 text-center text-sm text-green-300">
              {mensagemPagamentoTravado}
            </p>
          )}

          {podeDesconfirmar && (
            <button
              type="button"
              onClick={() => atualizarPagamento(false)}
              disabled={carregando}
              className="mt-4 w-full rounded-xl border border-red-900 bg-red-950/30 px-5 py-3 text-sm font-black text-red-300 transition hover:bg-red-950/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {carregando ? "Atualizando..." : "Desfazer confirmação do PIX"}
            </button>
          )}
        </div>
      )}

      {erro && <p className="mt-3 text-sm font-bold text-red-400">{erro}</p>}
    </div>
  );
}

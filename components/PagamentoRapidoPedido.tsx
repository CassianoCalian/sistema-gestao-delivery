"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  pedidoId: number;
  status: string;
  formaPagamento: string;
  pagamentoConfirmado: boolean;
  pagamentoDividido?: boolean;
  saldoPendente?: number;
};

export default function PagamentoRapidoPedido({
  pedidoId,
  status,
  formaPagamento,
  pagamentoConfirmado,
pagamentoDividido = false,
  saldoPendente = 0,
}: Props) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (status === "cancelado") return null;

  if (!["pix", "dinheiro", "cartao_entrega"].includes(formaPagamento)) {
    return null;
  }

  if (pagamentoConfirmado) {
    return (
      <div className="mt-3 inline-flex rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-400">
        PAGAMENTO CONFIRMADO
      </div>
    );
  }

  async function confirmar() {
    const mensagem =
      pagamentoDividido
        ? "Confirma que recebeu o saldo de R$ " +
          saldoPendente.toFixed(2).replace(".", ",") + "?"
        : formaPagamento === "pix"
        ? "O PIX realmente caiu na conta? Confirme no extrato antes de continuar."
        : "Voce realmente recebeu este pagamento? Confirme somente apos receber.";

    if (!window.confirm(`Pedido #${pedidoId}\n\n${mensagem}`)) {
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const resposta = await fetch(
        `/api/admin/pedidos/${pedidoId}/confirmar-pagamento`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmar: true }),
        },
      );

      const dados = await resposta.json();

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro || "Nao foi possivel confirmar.");
      }

      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error ? error.message : "Erro ao confirmar pagamento.",
      );
    } finally {
      setSalvando(false);
    }
  }

  const nome =
    pagamentoDividido
      ? "CONFIRMAR SALDO RECEBIDO"
      : formaPagamento === "pix"
      ? "CONFIRMAR PIX"
      : formaPagamento === "dinheiro"
        ? "MARCAR DINHEIRO PAGO"
        : "MARCAR CARTAO PAGO";

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={salvando}
        onClick={confirmar}
        className="min-h-11 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-400 transition hover:bg-emerald-400/20 disabled:opacity-50"
      >
        {salvando ? "CONFIRMANDO..." : nome}
      </button>
      {erro && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {erro}
        </p>
      )}
    </div>
  );
}
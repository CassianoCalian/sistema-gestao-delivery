"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderStatusButtonsProps = {
  pedidoId: number;
  statusAtual: string;
  telefone: string;
  formaPagamento: string;
  pagamentoConfirmado: boolean;
  codigoAcesso?: string;
};

const statusOpcoes = [
  {
    valor: "recebido",
    texto: "Recebido",
  },
  {
    valor: "em_preparacao",
    texto: "Em preparação",
  },
  {
    valor: "saiu_entrega",
    texto: "Saiu para entrega",
  },
  {
    valor: "entregue",
    texto: "Entregue",
  },
  {
    valor: "cancelado",
    texto: "Cancelar",
  },
];

const ordemStatus = ["recebido", "em_preparacao", "saiu_entrega", "entregue"];

const TRANSICOES_PERMITIDAS: Record<string, string[]> = {
  recebido: ["em_preparacao", "cancelado"],
  em_preparacao: ["recebido", "saiu_entrega", "cancelado"],
  saiu_entrega: ["em_preparacao", "entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};

const emojiCerveja = String.fromCodePoint(0x1f37a);
const emojiEntrega = String.fromCodePoint(0x1f69a);
const emojiLocalizacao = String.fromCodePoint(0x1f4cd);

function gerarMensagemStatus(
  pedidoId: number,
  status: string,
  codigoAcesso?: string,
) {
  const linkAcompanhamento =
    codigoAcesso && typeof window !== "undefined"
      ? `${window.location.origin}/pedido/${codigoAcesso}`
      : "";

  const acompanhamento = linkAcompanhamento
    ? `\n\n${emojiLocalizacao} Acompanhe seu pedido em tempo real:\n${linkAcompanhamento}`
    : "";
  if (status === "recebido") {
    return `Olá! Aqui é do Depósito do Zé ${emojiCerveja}. Recebemos seu pedido #${pedidoId} com sucesso! Em breve começaremos a preparação.${acompanhamento}`;
  }

  if (status === "em_preparacao") {
    return `Olá! Aqui é do Depósito do Zé ${emojiCerveja}. Seu pedido #${pedidoId} já está em preparação! Estamos separando tudo para você.${acompanhamento}`;
  }

  if (status === "saiu_entrega") {
    return `Olá! Aqui é do Depósito do Zé ${emojiEntrega}. Seu pedido #${pedidoId} saiu para entrega e já está a caminho!${acompanhamento}`;
  }

  if (status === "entregue") {
    return `Olá! Aqui é do Depósito do Zé ${emojiCerveja}. Seu pedido #${pedidoId} foi entregue. Muito obrigado pela preferência!${acompanhamento}`;
  }

  if (status === "cancelado") {
    return `Olá! Aqui é do Depósito do Zé. Precisamos falar com você sobre o cancelamento do pedido #${pedidoId}.${acompanhamento}`;
  }

  return `Olá! Aqui é do Depósito do Zé. Entramos em contato sobre o pedido #${pedidoId}.${acompanhamento}`;
}

function gerarLinkWhatsApp(
  telefone: string,
  pedidoId: number,
  status: string,
  codigoAcesso?: string,
) {
  const telefoneLimpo = telefone.replace(/\D/g, "");

  const numeroWhatsApp = telefoneLimpo.startsWith("55")
    ? telefoneLimpo
    : `55${telefoneLimpo}`;

  const mensagem = gerarMensagemStatus(pedidoId, status, codigoAcesso);

  const mensagemCodificada = encodeURIComponent(mensagem);

  return `https://web.whatsapp.com/send?phone=${numeroWhatsApp}&text=${mensagemCodificada}`;
}

export default function OrderStatusButtons({
  pedidoId,
  statusAtual,
  telefone,
  formaPagamento,
  pagamentoConfirmado,
  codigoAcesso,
}: OrderStatusButtonsProps) {
  const router = useRouter();

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [statusAlterado, setStatusAlterado] = useState<string | null>(null);

  async function alterarStatus(novoStatus: string) {
    if (novoStatus === statusAtual) {
      return;
    }

    if (novoStatus === "entregue") {
      const confirmou = window.confirm(
        "Confirmar que este pedido foi entregue ao cliente?",
      );

      if (!confirmou) {
        return;
      }
    }

    if (novoStatus === "cancelado") {
      const confirmou = window.confirm(
        "Tem certeza que deseja cancelar este pedido? O estoque dos produtos será devolvido automaticamente.",
      );

      if (!confirmou) {
        return;
      }
    }

    setErro("");
    setStatusAlterado(null);
    setCarregando(true);

    try {
      const resposta = await fetch(`/api/pedidos/${pedidoId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: novoStatus,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro ?? "Não foi possível alterar o status.");
      }

      const indiceAtual = ordemStatus.indexOf(statusAtual);
      const indiceNovo = ordemStatus.indexOf(novoStatus);

      const avancouStatus =
        indiceAtual !== -1 && indiceNovo !== -1 && indiceNovo > indiceAtual;

      if (avancouStatus || novoStatus === "cancelado") {
        setStatusAlterado(novoStatus);
      } else {
        setStatusAlterado(null);
      }

      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Erro ao atualizar o pedido.");
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="mt-5">
      <p className="mb-3 text-sm font-bold text-zinc-400">Alterar status</p>

      <div className="flex flex-wrap gap-2">
        {statusOpcoes.map((opcao) => {
          const selecionado = statusAtual === opcao.valor;

          const permitido =
            TRANSICOES_PERMITIDAS[statusAtual]?.includes(opcao.valor) ?? false;

          const bloqueadoPorPagamento =
            formaPagamento === "pix" &&
            !pagamentoConfirmado &&
            (opcao.valor === "saiu_entrega" || opcao.valor === "entregue");

          if (!selecionado && !permitido) {
            return null;
          }

          return (
            <button
              key={opcao.valor}
              type="button"
              disabled={carregando || selecionado || bloqueadoPorPagamento}
              onClick={() => alterarStatus(opcao.valor)}
              className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
                selecionado
                  ? "border-amber-400 bg-amber-400 text-zinc-950"
                  : opcao.valor === "cancelado"
                    ? "border-red-900 bg-red-950/30 text-red-300 hover:bg-red-950/60"
                    : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-400 hover:text-white"
              } disabled:cursor-not-allowed`}
            >
              {opcao.texto}
            </button>
          );
        })}
      </div>

      {formaPagamento === "pix" && !pagamentoConfirmado && (
        <p className="mt-3 text-sm font-bold text-amber-400">
          ⏳ Confirme o pagamento PIX para liberar a saída para entrega.
        </p>
      )}

      {carregando && (
        <p className="mt-3 text-sm text-zinc-500">Atualizando pedido...</p>
      )}

      {erro && <p className="mt-3 text-sm font-bold text-red-400">{erro}</p>}

      {statusAlterado && (
        <div className="mt-5 rounded-xl border border-green-900 bg-green-950/20 p-4">
          <a
            href={gerarLinkWhatsApp(
              telefone,
              pedidoId,
              statusAlterado,
              codigoAcesso,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-lg bg-green-500 px-4 py-3 text-sm font-black text-white transition hover:bg-green-400"
          >
            💬 Avisar cliente no WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

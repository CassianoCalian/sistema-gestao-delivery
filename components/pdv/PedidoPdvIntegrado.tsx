"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Produto = {
  nome: string;
  quantidade: number;
  subtotal: number;
};

type Props = {
  id: number;
  criadoEm: string;
  nome: string;
  telefone: string;
  endereco: string;
  status: string;
  pagamento: string;
  total: number;
  produtos: Produto[];
};

const moeda = (valor: number) =>
  Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

const rotulos: Record<string, string> = {
  recebido: "Pedido recebido",
  em_preparacao: "Em preparação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue"
};

function escapar(valor: unknown) {
  return String(valor ?? "").replace(/[&<>"']/g, (letra) => {
    const mapa: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return mapa[letra] || letra;
  });
}

export default function PedidoPdvIntegrado(props: Props) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  const proximos =
    props.status === "recebido"
      ? ["em_preparacao", "saiu_entrega", "entregue"]
      : props.status === "em_preparacao"
        ? ["saiu_entrega", "entregue"]
        : props.status === "saiu_entrega"
          ? ["entregue"]
          : [];

  const recebido = props.status === "recebido";
  const preparando = props.status === "em_preparacao";
  const saiu = props.status === "saiu_entrega";
  const entregue = props.status === "entregue";

  const estilo = recebido
    ? "border-amber-400/25 bg-amber-400/[0.04]"
    : preparando
      ? "border-orange-400/20 bg-orange-400/[0.035]"
      : saiu
        ? "border-blue-400/20 bg-blue-400/[0.035]"
        : entregue
          ? "border-emerald-400/15 bg-emerald-400/[0.025]"
          : "border-white/[0.07] bg-white/[0.025]";

  async function mudarStatus(status: string) {
    setOcupado(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/admin/pdv/entregas-convertidas",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            venda_id: props.id,
            status
          })
        }
      );

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.erro || "Falha ao atualizar a entrega."
        );
      }

      router.refresh();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Erro ao atualizar a entrega."
      );
    } finally {
      setOcupado(false);
    }
  }

  function imprimir() {
    const janela = window.open(
      "",
      "_blank",
      "width=430,height=720"
    );

    if (!janela) {
      setErro("Permita a abertura de janelas para imprimir.");
      return;
    }

    const linhas = props.produtos.map((produto) => `
      <tr>
        <td>
          ${escapar(produto.quantidade)}x
          ${escapar(produto.nome)}
        </td>
        <td style="text-align:right">
          ${escapar(moeda(produto.subtotal))}
        </td>
      </tr>
    `).join("");

    const data = new Date(props.criadoEm).toLocaleString(
      "pt-BR",
      { timeZone: "America/Sao_Paulo" }
    );

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Comanda ${props.id}</title>
<style>
body{font-family:Arial,sans-serif;width:280px;margin:12px auto;color:#111;font-size:12px}
h2,.centro{text-align:center}
hr{border:0;border-top:1px dashed #333;margin:12px 0}
p{margin:6px 0;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse}
td{padding:5px 0;vertical-align:top}
.total{font-size:19px;font-weight:bold}
@page{size:80mm auto;margin:4mm}
</style>
</head>
<body>
<h2>DEPÓSITO DO ZÉ</h2>
<p class="centro">COMANDA DELIVERY - PDV</p>
<p class="centro">Venda #${props.id}</p>
<hr>
<p><b>Cliente:</b> ${escapar(props.nome)}</p>
<p><b>Telefone:</b> ${escapar(props.telefone)}</p>
<p><b>Endereço:</b> ${escapar(props.endereco)}</p>
<p><b>Data:</b> ${escapar(data)}</p>
<hr>
<table>${linhas}</table>
<hr>
<p><b>Pagamento:</b> ${escapar(props.pagamento)}</p>
<p class="total">TOTAL: ${escapar(moeda(props.total))}</p>
<hr>
<p class="centro">Obrigado pela preferência!</p>
</body>
</html>`;

    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    janela.focus();

    window.setTimeout(() => janela.print(), 350);
  }

  return (
    <article
      className={`group/pedido relative overflow-hidden rounded-[28px] border p-5 transition duration-500 hover:-translate-y-0.5 sm:p-6 ${estilo}`}
    >
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

        <div className="flex min-w-0 items-start gap-4">

          <div className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-[19px] border border-amber-400/20 bg-amber-400/[0.08] px-3 text-base font-black text-amber-400">
            #{props.id}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-zinc-500">
                Cliente
              </span>

              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[8px] font-black uppercase text-zinc-400">
                PDV Delivery
              </span>

              {recebido && (
                <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[8px] font-black uppercase text-zinc-950">
                  Novo
                </span>
              )}
            </div>

            <h2 className="mt-1 text-xl font-black tracking-[-0.035em] text-white sm:text-2xl">
              {props.nome}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[8px] font-black uppercase text-zinc-400">
                {props.pagamento}
              </span>

              <span className="text-xs text-zinc-500">
                {new Date(props.criadoEm).toLocaleString(
                  "pt-BR",
                  { timeZone: "America/Sao_Paulo" }
                )}
              </span>
            </div>

            <p className="mt-3 text-sm text-zinc-400">
              {props.endereco}
            </p>

            {props.telefone && (
              <p className="mt-1 text-xs text-zinc-500">
                {props.telefone}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-end justify-between gap-3 lg:flex-col lg:items-end">
          <div className="lg:text-right">
            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-zinc-500">
              Total do pedido
            </p>

            <p className="mt-1 text-2xl font-black text-white">
              {moeda(props.total)}
            </p>
          </div>

          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[9px] font-black text-zinc-200">
            {rotulos[props.status] || props.status}
          </span>
        </div>
      </div>

      <div className="my-5 h-px bg-gradient-to-r from-white/10 to-transparent" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-3 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-500">
            Controle operacional
          </p>

          <div className="flex flex-wrap gap-2">
            {proximos.map((status) => (
              <button
                key={status}
                type="button"
                disabled={ocupado}
                onClick={() => void mudarStatus(status)}
                className="rounded-[14px] border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs font-black text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50"
              >
                {ocupado
                  ? "Salvando..."
                  : status === "entregue"
                    ? "Finalizar agora"
                    : rotulos[status]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={imprimir}
          className="rounded-[15px] bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
        >
          Imprimir comanda
        </button>
      </div>

      <details className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <summary className="cursor-pointer text-xs font-black text-zinc-300">
          Ver endereço e produtos
        </summary>

        <div className="mt-3 space-y-2 text-xs text-zinc-300">
          <p><b>Endereço:</b> {props.endereco || "Não informado"}</p>

          {props.produtos.map((produto, indice) => (
            <div
              key={indice}
              className="flex justify-between gap-3 border-t border-white/[0.05] pt-2"
            >
              <span>
                {produto.quantidade}x {produto.nome}
              </span>

              <span>
                {moeda(produto.subtotal)}
              </span>
            </div>
          ))}
        </div>
      </details>

      {erro && (
        <p role="alert" className="mt-3 text-xs text-red-400">
          {erro}
        </p>
      )}
    </article>
  );
}
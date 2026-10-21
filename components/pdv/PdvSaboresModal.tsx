"use client";

import { useState } from "react";
import type { PdvProduto } from "../../app/admin/pdv/page";

type Opcao = {
  opcao_id: number;
  nome: string;
  quantidade: number;
};

type Props = {
  produto: PdvProduto;
  item?: {
    quantidade: number;
    opcoes_selecionadas?: Opcao[];
  };
  onFechar: () => void;
  onSalvar: (produto: PdvProduto, quantidade: number, opcoes: Opcao[]) => void;
};

export default function PdvSaboresModal({
  produto,
  item,
  onFechar,
  onSalvar,
}: Props) {
  const [quantidade, setQuantidade] = useState(item?.quantidade ?? 1);

  const [sabores, setSabores] = useState<Record<number, number>>(
    () =>
      Object.fromEntries(
        (item?.opcoes_selecionadas ?? []).map((opcao) => [
          opcao.opcao_id,
          opcao.quantidade,
        ]),
      ) as Record<number, number>,
  );

  const necessarios = produto.unidades_por_item * quantidade;

  const selecionados = Object.values(sabores).reduce(
    (total, valor) => total + valor,
    0,
  );

  const estoque = Math.min(999, Math.max(0, Math.floor(produto.estoque)));

  const valido =
    quantidade >= 1 &&
    quantidade <= estoque &&
    selecionados === necessarios &&
    necessarios > 0;

  function mudarSabor(id: number, diferenca: number) {
    setSabores((atual) => {
      const totalAtual = Object.values(atual).reduce(
        (soma, valor) => soma + valor,
        0,
      );

      if (diferenca > 0 && totalAtual >= necessarios) {
        return atual;
      }

      return {
        ...atual,
        [id]: Math.max(0, (atual[id] ?? 0) + diferenca),
      };
    });
  }

  function salvar() {
    if (!valido) return;

    const opcoes = produto.opcoes
      .filter((opcao) => opcao.ativo)
      .map((opcao) => ({
        opcao_id: opcao.id,
        nome: opcao.nome,
        quantidade: sabores[opcao.id] ?? 0,
      }))
      .filter((opcao) => opcao.quantidade > 0);

    onSalvar(produto, quantidade, opcoes);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-sabores-pdv"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-amber-400/30 bg-zinc-950 p-5 text-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-400">
              Personalizar produto
            </p>

            <h2 id="titulo-sabores-pdv" className="mt-2 text-xl font-black">
              {produto.nome}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              {produto.unidades_por_item} unidade(s) por produto
            </p>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl border border-white/15 px-3 py-2 text-lg"
            aria-label="Fechar sabores"
          >
            ×
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <span className="text-sm font-bold">Quantidade de produtos</span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={quantidade <= 1}
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              className="h-10 w-10 rounded-lg bg-zinc-800 text-lg disabled:opacity-30"
            >
              −
            </button>

            <strong>{quantidade}</strong>

            <button
              type="button"
              disabled={quantidade >= estoque}
              onClick={() => setQuantidade((q) => Math.min(estoque, q + 1))}
              className="h-10 w-10 rounded-lg bg-amber-400 text-lg text-black disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        <p
          className={`mt-5 rounded-xl p-3 text-sm font-black ${
            selecionados === necessarios
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-400/10 text-amber-300"
          }`}
        >
          Sabores selecionados: {selecionados} de {necessarios}
        </p>

        <div className="mt-4 max-h-[38vh] space-y-2 overflow-y-auto">
          {produto.opcoes
            .filter((opcao) => opcao.ativo)
            .map((opcao) => (
              <div
                key={opcao.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <span className="min-w-0 text-sm font-bold">{opcao.nome}</span>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={(sabores[opcao.id] ?? 0) === 0}
                    onClick={() => mudarSabor(opcao.id, -1)}
                    className="h-9 w-9 rounded-lg bg-zinc-800 text-lg disabled:opacity-30"
                  >
                    −
                  </button>

                  <strong className="min-w-5 text-center">
                    {sabores[opcao.id] ?? 0}
                  </strong>

                  <button
                    type="button"
                    disabled={selecionados >= necessarios}
                    onClick={() => mudarSabor(opcao.id, 1)}
                    className="h-9 w-9 rounded-lg bg-amber-400 text-lg font-black text-black disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onFechar}
            className="h-12 rounded-xl border border-white/20 font-bold"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={!valido}
            onClick={salvar}
            className="h-12 rounded-xl bg-emerald-500 font-black text-black disabled:opacity-30"
          >
            Salvar sabores
          </button>
        </div>
      </div>
    </div>
  );
}
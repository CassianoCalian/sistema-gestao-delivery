"use client";

import { useEffect, useState } from "react";

type Grupo = {
  quantidade: number;
  valor: number;
};

type Resumo = {
  periodo: string;
  balcao: Grupo;
  deliveryPedidos: Grupo;
  deliveryConvertido: Grupo;
  delivery: Grupo;
  geral: Grupo;
  vazio?: boolean;
};

const brl = (valor: number) =>
  Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export default function ResumoCanaisFinanceiro({
  modo = "hoje"
}: {
  modo?: "hoje" | "turno";
}) {
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      try {
        const resposta = await fetch(
          `/api/admin/resumo-canais?modo=${modo}`,
          { cache: "no-store" }
        );

        const resultado = await resposta.json();

        if (!resposta.ok) {
          throw new Error(resultado.erro);
        }

        if (ativo) {
          setDados(resultado);
          setErro("");
        }
      } catch {
        if (ativo) {
          setDados(null);
          setErro("Resumo financeiro indisponivel");
        }
      }
    }

    void atualizar();

    const timer = window.setInterval(() => {
      void atualizar();
    }, 30000);

    return () => {
      ativo = false;
      window.clearInterval(timer);
    };
  }, [modo]);

  if (dados?.vazio) return null;

  return (
    <section className="mx-auto my-4 w-full max-w-7xl rounded-2xl border border-emerald-400/25 bg-zinc-950 p-4 text-white">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-300">
            Faturamento unificado por canal
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            {dados?.periodo || "Carregando..."} - sem duplicar o caixa
          </p>
        </div>

        {erro && (
          <p className="text-xs text-red-300">{erro}</p>
        )}
      </div>

      {dados && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
            <p className="text-xs text-amber-300">
              Balcao ({dados.balcao.quantidade})
            </p>

            <p className="mt-1 text-xl font-black">
              {brl(dados.balcao.valor)}
            </p>
          </div>

          <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-3">
            <p className="text-xs text-blue-300">
              Delivery ({dados.delivery.quantidade})
            </p>

            <p className="mt-1 text-xl font-black">
              {brl(dados.delivery.valor)}
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              {brl(dados.deliveryPedidos.valor)} em pedidos
              {" + "}
              {brl(dados.deliveryConvertido.valor)} convertidos
            </p>
          </div>

          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
            <p className="text-xs text-emerald-300">
              Total geral ({dados.geral.quantidade})
            </p>

            <p className="mt-1 text-xl font-black">
              {brl(dados.geral.valor)}
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              Balcao + Delivery, uma vez cada
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
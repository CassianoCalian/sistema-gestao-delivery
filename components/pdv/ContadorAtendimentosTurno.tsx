"use client";

import { useEffect, useState } from "react";

type Resultado = {
  sucesso?: boolean;
  turno?: number | null;
  balcao?: number;
  entregas?: number;
};

export default function ContadorAtendimentosTurno() {
  const [dados, setDados] = useState<Resultado | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const resposta = await fetch("/api/admin/pdv/contador-turno", {
          cache: "no-store",
        });

        const resultado = (await resposta.json()) as Resultado;

        if (!resposta.ok || !resultado.sucesso) {
          throw new Error("Consulta falhou");
        }

        if (ativo) setDados(resultado);
      } catch {
        if (ativo) setDados(null);
      }
    }

    void carregar();

    const intervalo = setInterval(() => void carregar(), 15000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  const total = dados
    ? (dados.balcao ?? 0) + (dados.entregas ?? 0)
    : null;

  return (
    <div
      className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-300"
      title="Cada venda ou pedido conta como um atendimento, nao clientes unicos"
    >
      <span className="font-black">
        Atendimentos do turno: {total ?? "—"}
      </span>

      {dados?.turno ? (
        <span className="ml-2 text-amber-100/80">
          Balcao {dados.balcao ?? 0} | Entregas {dados.entregas ?? 0}
        </span>
      ) : (
        <span className="ml-2 text-amber-100/80">
          {dados ? "Sem turno aberto" : "Consultando..."}
        </span>
      )}
    </div>
  );
}
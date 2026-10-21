"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PedidoAutoRefreshProps = {
  statusAtual: string;
};

const INTERVALO_ATUALIZACAO = 5000;
const INTERVALO_MINIMO = 1500;

export default function PedidoAutoRefresh({
  statusAtual,
}: PedidoAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (statusAtual === "entregue" || statusAtual === "cancelado") {
      return;
    }

    let ultimaAtualizacao = 0;

    const atualizarSeNecessario = () => {
      if (document.hidden || !navigator.onLine) {
        return;
      }

      const agora = Date.now();

      if (agora - ultimaAtualizacao < INTERVALO_MINIMO) {
        return;
      }

      ultimaAtualizacao = agora;
      router.refresh();
    };

    const intervalo = window.setInterval(
      atualizarSeNecessario,
      INTERVALO_ATUALIZACAO,
    );

    window.addEventListener("focus", atualizarSeNecessario);
    window.addEventListener("online", atualizarSeNecessario);

    document.addEventListener(
      "visibilitychange",
      atualizarSeNecessario,
    );

    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", atualizarSeNecessario);
      window.removeEventListener("online", atualizarSeNecessario);

      document.removeEventListener(
        "visibilitychange",
        atualizarSeNecessario,
      );
    };
  }, [router, statusAtual]);

  return null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PedidoAutoRefreshProps = {
  statusAtual: string;
};

export default function PedidoAutoRefresh({
  statusAtual,
}: PedidoAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (statusAtual === "entregue" || statusAtual === "cancelado") {
      return;
    }

    const intervalo = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(intervalo);
  }, [router, statusAtual]);

  return null;
}

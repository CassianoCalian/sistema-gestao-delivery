"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminProductsAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function atualizarProdutos() {
      router.refresh();
    }

    // Atualiza periodicamente enquanto o painel está aberto
    const intervalo = setInterval(atualizarProdutos, 5000);

    // Atualiza imediatamente ao voltar para a aba
    function aoVoltarParaAba() {
      if (document.visibilityState === "visible") {
        atualizarProdutos();
      }
    }

    window.addEventListener("focus", atualizarProdutos);
    document.addEventListener("visibilitychange", aoVoltarParaAba);

    return () => {
      clearInterval(intervalo);

      window.removeEventListener("focus", atualizarProdutos);

      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [router]);

  return null;
}

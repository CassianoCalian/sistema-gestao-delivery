"use client";

import { useEffect, useState } from "react";
import PdvClient from "./PdvClient";
import { carregarFotoCatalogo, type FotoCatalogo } from "../../lib/pdvOffline";

export default function PdvOfflineBootstrap() {
  const [foto, setFoto] = useState<FotoCatalogo | null>(null);
  const [mensagem, setMensagem] = useState("Carregando catálogo salvo no computador...");

  useEffect(() => {
    let montado = true;
    void carregarFotoCatalogo().then((dados) => {
      if (!montado) return;
      if (dados?.produtos?.length) setFoto(dados);
      else setMensagem("O catálogo ainda não está preparado. Abra o PDV com internet neste navegador antes de usar o modo offline.");
    }).catch(() => {
      if (montado) setMensagem("O armazenamento local está indisponível. Não é seguro registrar vendas.");
    });
    return () => { montado = false; };
  }, []);

  if (!foto) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-white">
        <p className="max-w-xl rounded-xl border border-amber-400/30 p-5 text-center text-amber-200">{mensagem}</p>
      </main>
    );
  }

  return (
    <main className="ze-pdv-v3 min-h-screen w-full bg-[#070707] text-white xl:h-[100dvh] xl:min-h-0 xl:overflow-hidden">
      <div className="flex min-h-screen w-full flex-col p-3 lg:p-4 xl:h-full xl:min-h-0 xl:gap-2 xl:overflow-hidden">
        <PdvClient produtos={foto.produtos} categorias={foto.categorias} clientes={[]} />
      </div>
    </main>
  );
}

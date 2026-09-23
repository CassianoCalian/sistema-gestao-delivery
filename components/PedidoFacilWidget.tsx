"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export default function PedidoFacilWidget() {
  const [aberto, setAberto] = useState(true);
  const [minimizado, setMinimizado] = useState(false);
  const pathname = usePathname();

  if (
    pathname === "/pedido-facil" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/pedido/")
  ) {
    return null;
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAberto(true);
          setMinimizado(false);
        }}
        className="fixed bottom-5 right-5 z-[9999] flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-3xl text-black shadow-2xl transition hover:scale-105"
        aria-label="Abrir Pedido Fácil"
      >
        💬
      </button>
    );
  }

  if (minimizado) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999] w-[calc(100%-2rem)] max-w-[390px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <button
          type="button"
          onClick={() => setMinimizado(false)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-xl">
              🍺
            </div>

            <div>
              <p className="font-black text-white">Pedido Fácil</p>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-xs text-zinc-400">Online</span>
              </div>
            </div>
          </div>

          <span className="text-xl text-zinc-400">↑</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="
        fixed z-[9999] overflow-hidden
        border border-white/10 bg-zinc-950 shadow-2xl

        inset-x-3 bottom-3 top-3
        rounded-3xl

        md:inset-auto
        md:bottom-5
        md:right-5
        md:h-[720px]
        md:w-[420px]
      "
    >
      {/* CABEÇALHO */}
      <div className="flex h-[72px] items-center justify-between border-b border-white/10 bg-zinc-950 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-xl">
            🍺
          </div>

          <div>
            <p className="font-black text-white">Pedido Fácil</p>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs text-zinc-400">
                Online • Faça seu pedido aqui
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* MINIMIZAR */}
          <button
            type="button"
            onClick={() => setMinimizado(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Minimizar"
          >
            —
          </button>

          {/* FECHAR */}
          <button
            type="button"
            onClick={() => setAberto(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      </div>

      {/* CONTEÚDO DO PEDIDO FÁCIL */}
      <iframe
        src="/pedido-facil"
        title="Pedido Fácil"
        className="h-[calc(100%-72px)] w-full border-0 bg-zinc-950"
      />
    </div>
  );
}

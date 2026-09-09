"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { useCart } from "../context/CartContext";

import CartDrawer from "./CartDrawer";

type HeaderProps = {
  buscaAtual?: string;
};

export default function Header({ buscaAtual = "" }: HeaderProps) {
  const { quantidadeTotal } = useCart();

  const [carrinhoAberto, setCarrinhoAberto] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-zinc-950/80 shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 md:gap-6 md:py-4">
          {/* MARCA */}
          <Link
            href="/"
            className="pressable group flex min-w-0 shrink-0 items-center gap-2 sm:gap-3"
            aria-label="Página inicial do Depósito do Zé"
          >
            <div className="relative h-12 w-[92px] shrink-0 sm:h-14 sm:w-[112px] md:h-16 md:w-[132px]">
              <Image
                src="/logo-deposito-ze.png"
                alt="Depósito do Zé"
                fill
                priority
                sizes="(max-width: 640px) 92px, (max-width: 768px) 112px, 132px"
                className="object-contain drop-shadow-[0_8px_18px_rgba(245,158,11,0.18)] transition duration-300 group-hover:scale-[1.03]"
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>

                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-400">
                  Entregando
                </span>
              </div>

              <p className="mt-1 whitespace-nowrap text-[10px] font-medium text-zinc-500 md:text-xs">
                Bebida gelada na sua porta
              </p>
            </div>
          </Link>

          {/* BUSCA DESKTOP */}
          <form
            action="/#produtos"
            method="GET"
            className="group relative hidden flex-1 md:flex"
          >
            <div className="relative flex w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] transition duration-300 focus-within:border-amber-400/40 focus-within:bg-white/[0.055] focus-within:shadow-[0_0_0_4px_rgba(251,191,36,0.05)]">
              <div className="flex items-center pl-4 text-zinc-600 transition group-focus-within:text-amber-400">
                <span className="text-sm">⌕</span>
              </div>

              <input
                type="text"
                name="busca"
                defaultValue={buscaAtual}
                placeholder="O que você está procurando?"
                className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm font-medium text-white placeholder:text-zinc-600"
              />

              <button
                type="submit"
                className="pressable m-1.5 rounded-xl bg-white/[0.06] px-5 text-xs font-black uppercase tracking-[0.08em] text-zinc-300 transition hover:bg-amber-400 hover:text-zinc-950"
              >
                Buscar
              </button>
            </div>
          </form>

          {/* CARRINHO */}
          <button
            id="cart-button"
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            className="pressable group relative ml-auto flex min-h-11 shrink-0 items-center justify-center gap-2 overflow-visible rounded-2xl border border-amber-300/20 bg-amber-400 px-3.5 py-2.5 font-black text-zinc-950 shadow-[0_8px_26px_rgba(245,158,11,0.18)] transition sm:px-4 md:min-h-12 md:px-5"
            aria-label={`Abrir carrinho com ${quantidadeTotal} item${quantidadeTotal === 1 ? "" : "s"}`}
          >
            {/* BRILHO */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute -left-10 top-0 h-full w-8 rotate-12 bg-white/25 blur-sm transition-transform duration-700 group-hover:translate-x-36" />
            </div>

            <span className="relative text-base transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
              🛒
            </span>

            <span className="relative hidden text-xs uppercase tracking-[0.04em] sm:inline">
              Carrinho
            </span>

            {quantidadeTotal > 0 && (
              <span className="animate-scale-in absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-zinc-950 bg-red-500 px-1 text-[10px] font-black text-white shadow-lg">
                {quantidadeTotal > 99 ? "99+" : quantidadeTotal}
              </span>
            )}
          </button>
        </div>

        {/* LINHA DE LUZ */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent" />
      </header>

      <CartDrawer
        aberto={carrinhoAberto}
        fechar={() => setCarrinhoAberto(false)}
      />
    </>
  );
}

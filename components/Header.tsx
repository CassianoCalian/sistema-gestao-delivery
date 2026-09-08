"use client";

import { useState } from "react";

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
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-amber-400">
              DEPÓSITO DO ZÉ
            </h1>

            <p className="text-xs text-zinc-400">Bebida gelada na sua porta</p>
          </div>

          <form
            action="/#produtos"
            method="GET"
            className="hidden flex-1 md:flex"
          >
            <input
              type="text"
              name="busca"
              defaultValue={buscaAtual}
              placeholder="O que você está procurando?"
              className="w-full rounded-l-xl border border-r-0 border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
            />

            <button
              type="submit"
              className="rounded-r-xl bg-amber-400 px-5 font-black text-zinc-950 transition hover:bg-amber-300"
            >
              🔎
            </button>
          </form>

          <button
            type="button"
            onClick={() => setCarrinhoAberto(true)}
            className="relative rounded-xl bg-amber-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-amber-300"
          >
            🛒 Carrinho
            {quantidadeTotal > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-black text-white">
                {quantidadeTotal}
              </span>
            )}
          </button>
        </div>
      </header>

      <CartDrawer
        aberto={carrinhoAberto}
        fechar={() => setCarrinhoAberto(false)}
      />
    </>
  );
}

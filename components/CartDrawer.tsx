"use client";

"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import { useRouter } from "next/navigation";

import { useCart } from "../context/CartContext";

type CartDrawerProps = {
  aberto: boolean;
  fechar: () => void;
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CartDrawer({ aberto, fechar }: CartDrawerProps) {
  const {
    itens,
    aumentarQuantidade,
    diminuirQuantidade,
    removerProduto,
    limparCarrinho,
    quantidadeTotal,
    valorTotal,
  } = useCart();

  const router = useRouter();

  const VALOR_MINIMO_PEDIDO = 30;

  const temExcecaoMinimo = itens.some(
    (item) => item.permite_abaixo_minimo === true,
  );

  const podeFinalizarPorMinimo =
    valorTotal >= VALOR_MINIMO_PEDIDO || temExcecaoMinimo;

  const valorFaltante = Math.max(0, VALOR_MINIMO_PEDIDO - valorTotal);

  const painelRef = useRef<HTMLElement | null>(null);
  const fundoRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!aberto) {
      return;
    }

    const painel = painelRef.current;
    const fundo = fundoRef.current;

    const reduzirMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!reduzirMovimento) {
      fundo?.animate(
        [
          {
            opacity: 0,
          },
          {
            opacity: 1,
          },
        ],
        {
          duration: 220,
          easing: "ease-out",
          fill: "forwards",
        },
      );

      painel?.animate(
        [
          {
            transform: "translate3d(100%, 0, 0)",
            opacity: 0.7,
          },
          {
            transform: "translate3d(0, 0, 0)",
            opacity: 1,
          },
        ],
        {
          duration: 340,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "forwards",
        },
      );
    }

    const overflowAnterior = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        fechar();
      }
    }

    window.addEventListener("keydown", fecharComEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;

      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [aberto, fechar]);

  if (!aberto) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* FUNDO */}
      <button
        ref={fundoRef}
        type="button"
        aria-label="Fechar carrinho"
        onClick={fechar}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* PAINEL */}
      <aside
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        className="absolute right-0 top-0 flex h-full w-full max-w-[430px] flex-col overflow-hidden border-l border-white/[0.07] bg-zinc-950 shadow-[-30px_0_80px_rgba(0,0,0,0.55)] [will-change:transform,opacity]"
      >
        {/* GLOW */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/[0.07] blur-[100px]"
        />

        {/* CABEÇALHO */}
        <div className="relative z-10 border-b border-white/[0.06] bg-zinc-950/90 px-5 pb-4 pt-5 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="h-px w-5 bg-amber-400" />

                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
                  Seu pedido
                </p>
              </div>

              <h2 className="text-2xl font-black tracking-[-0.035em] text-white">
                Seu carrinho
              </h2>

              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-full border border-white/[0.06] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-zinc-400">
                  {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
                </span>

                {quantidadeTotal > 0 && (
                  <span
                    className={`flex items-center gap-1.5 text-[10px] font-bold ${
                      podeFinalizarPorMinimo
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 animate-pulse rounded-full ${
                        podeFinalizarPorMinimo
                          ? "bg-emerald-400"
                          : "bg-amber-400"
                      }`}
                    />

                    {podeFinalizarPorMinimo
                      ? "Pronto para finalizar"
                      : "Complete seu pedido"}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar carrinho"
              className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04] text-lg font-bold text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* PRODUTOS */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {itens.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center px-5 text-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-400/10 blur-3xl" />

                <div className="premium-card relative flex h-24 w-24 items-center justify-center rounded-[32px] text-4xl">
                  🛒
                </div>
              </div>

              <h3 className="mt-6 text-xl font-black tracking-[-0.025em] text-white">
                Seu carrinho está vazio
              </h3>

              <p className="mt-2 max-w-[270px] text-sm leading-6 text-zinc-500">
                Escolha suas bebidas favoritas e monte seu pedido.
              </p>

              <button
                type="button"
                onClick={fechar}
                className="brand-button pressable mt-6 rounded-2xl px-6 py-3.5 text-xs font-black uppercase tracking-[0.08em]"
              >
                Ver produtos
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {itens.map((item, index) => (
                <article
                  key={item.id}
                  className="premium-card animate-slide-up relative overflow-hidden rounded-[22px] p-3.5 sm:p-4"
                  style={{
                    animationDelay: `${Math.min(index, 6) * 55}ms`,
                  }}
                >
                  <div className="flex gap-3.5">
                    {/* IMAGEM */}
                    <div className="relative flex h-[78px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.035] sm:h-20 sm:w-20">
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent"
                      />

                      {item.imagem_url ? (
                        <Image
                          src={item.imagem_url}
                          alt={item.nome}
                          fill
                          sizes="80px"
                          quality={60}
                          className="relative object-contain p-2.5"
                        />
                      ) : (
                        <span className="relative text-3xl">🥤</span>
                      )}
                    </div>

                    {/* DADOS */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-[14px] font-black leading-5 text-white sm:text-[15px]">
                            {item.nome}
                          </h3>

                          <p className="mt-1 text-[15px] font-black tracking-[-0.03em] text-amber-400">
                            {formatarPreco(item.preco)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removerProduto(item.id)}
                          aria-label={`Remover ${item.nome}`}
                          className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/[0.07] text-xs text-red-400 transition hover:bg-red-500/15 hover:text-red-300"
                        >
                          ✕
                        </button>
                      </div>

                      {/* QUANTIDADE */}
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex h-10 items-center overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
                          <button
                            type="button"
                            onClick={() => diminuirQuantidade(item.id)}
                            aria-label={`Diminuir quantidade de ${item.nome}`}
                            className="pressable flex h-full w-10 items-center justify-center text-lg font-black text-zinc-400 transition hover:bg-white/[0.05] hover:text-amber-400"
                          >
                            −
                          </button>

                          <span className="flex min-w-8 items-center justify-center text-sm font-black text-white">
                            {item.quantidade}
                          </span>

                          <button
                            type="button"
                            onClick={() => aumentarQuantidade(item.id)}
                            disabled={item.quantidade >= item.estoque}
                            aria-label={`Aumentar quantidade de ${item.nome}`}
                            className="pressable flex h-full w-10 items-center justify-center text-lg font-black text-zinc-400 transition hover:bg-white/[0.05] hover:text-amber-400 disabled:cursor-not-allowed disabled:text-zinc-700"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                            Subtotal
                          </p>

                          <p className="mt-0.5 text-xs font-black text-zinc-300">
                            {formatarPreco(item.preco * item.quantidade)}
                          </p>
                        </div>
                      </div>

                      {item.quantidade >= item.estoque && (
                        <div className="mt-2.5 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />

                          <p className="text-[9px] font-black text-orange-400">
                            Máximo disponível: {item.estoque}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        {itens.length > 0 && (
          <div className="safe-bottom relative z-20 border-t border-white/[0.07] bg-zinc-950/95 px-5 pb-4 pt-4 shadow-[0_-20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:px-6">
            {/* RESUMO */}
            <div className="mb-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-600">
                    Total do pedido
                  </p>

                  <p className="mt-1 text-xs font-medium text-zinc-500">
                    Frete calculado no checkout
                  </p>
                  {!podeFinalizarPorMinimo && (
                    <p className="mt-2 text-[10px] font-bold leading-4 text-amber-400">
                      Faltam {formatarPreco(valorFaltante)} para o pedido mínimo
                      de {formatarPreco(VALOR_MINIMO_PEDIDO)}.
                    </p>
                  )}
                </div>

                <span className="text-2xl font-black tracking-[-0.04em] text-amber-400">
                  {formatarPreco(valorTotal)}
                </span>
              </div>
            </div>

            {/* FINALIZAR */}
            <button
              type="button"
              onClick={() => {
                fechar();
                router.push("/checkout");
              }}
              className="brand-button pressable group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.06em]"
            >
              Finalizar pedido
              <span className="transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>

            {/* LIMPAR */}
            <button
              type="button"
              onClick={limparCarrinho}
              className="pressable mt-2.5 w-full rounded-xl py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600 transition hover:text-red-400"
            >
              Limpar carrinho
            </button>
          </div>
        )}

        {/* LINHA DE LUZ */}
        <div className="pointer-events-none absolute bottom-0 left-[15%] right-[15%] z-30 h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
      </aside>
    </div>
  );
}

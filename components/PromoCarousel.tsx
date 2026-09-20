"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useCart } from "../context/CartContext";

export type ProdutoPromocional = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_promocional: number;
  imagem_url: string | null;
  estoque: number;
  unidades_por_item: number;
  permite_abaixo_minimo: boolean;

  opcoes:
    | {
        id: number;
        nome: string;
        ativo: boolean;
        ordem: number;
      }[]
    | null;
};

type PromoCarouselProps = {
  produtos: ProdutoPromocional[];
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function calcularDesconto(preco: number, promocional: number) {
  if (preco <= 0 || promocional >= preco) {
    return 0;
  }

  return Math.round(((preco - promocional) / preco) * 100);
}

export default function PromoCarousel({ produtos }: PromoCarouselProps) {
  const [indiceAtual, setIndiceAtual] = useState(0);
  const { adicionarProduto, itens } = useCart();

  const [produtoAdicionadoId, setProdutoAdicionadoId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (produtos.length <= 1) {
      return;
    }

    const intervalo = window.setInterval(() => {
      setIndiceAtual((indiceAnterior) =>
        indiceAnterior === produtos.length - 1 ? 0 : indiceAnterior + 1,
      );
    }, 5000);

    return () => window.clearInterval(intervalo);
  }, [produtos.length]);

  if (produtos.length === 0) {
    return null;
  }

  const produto = produtos[indiceAtual];
  const quantidadeNoCarrinho = itens
    .filter((item) => item.id === produto.id)
    .reduce((total, item) => total + item.quantidade, 0);

  const limiteAtingido = quantidadeNoCarrinho >= produto.estoque;

  const foiAdicionado = produtoAdicionadoId === produto.id;

  const desconto = calcularDesconto(
    Number(produto.preco),
    Number(produto.preco_promocional),
  );

  function anterior() {
    setIndiceAtual((indiceAnterior) =>
      indiceAnterior === 0 ? produtos.length - 1 : indiceAnterior - 1,
    );
  }

  function proximo() {
    setIndiceAtual((indiceAnterior) =>
      indiceAnterior === produtos.length - 1 ? 0 : indiceAnterior + 1,
    );
  }

  function adicionarPromocao() {
    if (limiteAtingido) {
      return;
    }

    adicionarProduto({
      id: produto.id,
      nome: produto.nome,
      preco: Number(produto.preco_promocional),
      imagem_url: produto.imagem_url,
      estoque: produto.estoque,
      unidades_por_item: Number(produto.unidades_por_item ?? 0),
      permite_abaixo_minimo: produto.permite_abaixo_minimo,
      opcoes: produto.opcoes ?? [],
      opcao_selecionada: null,
    });

    setProdutoAdicionadoId(produto.id);

    window.setTimeout(() => {
      setProdutoAdicionadoId(null);
    }, 1200);
  }

  return (
    <section className="animate-fade-in relative mt-6 overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:mt-8 md:rounded-[36px]">
      {/* LUZES */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-600/25 blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-[360px] w-[360px] rounded-full bg-violet-600/25 blur-[110px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[42%] top-[16%] h-56 w-56 rounded-full bg-fuchsia-500/10 blur-[100px]"
      />

      {/* GRADE */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
        }}
      />

      <div
        key={produto.id}
        className="relative grid min-h-[530px] items-center gap-8 px-5 py-7 sm:px-7 sm:py-9 md:min-h-[470px] md:grid-cols-[1.08fr_0.92fr] md:px-12 md:py-12 lg:px-16"
      >
        {/* TEXTO */}
        <div className="relative z-10">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/[0.08] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-violet-200 backdrop-blur-md shadow-[0_0_30px_rgba(139,92,246,0.08)] sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
              </span>
              Oferta do Zé
            </span>
          </div>

          <div className="animate-slide-up delay-1">
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 sm:text-sm">
              Promoção por tempo limitado
            </p>

            <h1 className="mt-2 max-w-xl text-[38px] font-black leading-[0.96] tracking-[-0.045em] text-white sm:text-5xl md:text-[54px] lg:text-[64px]">
              {produto.nome}
            </h1>
          </div>

          {produto.descricao && (
            <p className="animate-slide-up delay-2 mt-5 max-w-lg text-[15px] font-medium leading-6 text-zinc-400 sm:text-base sm:leading-7">
              {produto.descricao}
            </p>
          )}

          {/* PREÇO */}
          <div className="animate-slide-up delay-3 mt-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-zinc-600 line-through">
                    {formatarPreco(Number(produto.preco))}
                  </span>

                  {desconto > 0 && (
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                      -{desconto}%
                    </span>
                  )}
                </div>

                <p className="text-[42px] font-black leading-none tracking-[-0.05em] text-white sm:text-5xl">
                  {formatarPreco(Number(produto.preco_promocional))}
                </p>
              </div>

              <button
                type="button"
                onClick={adicionarPromocao}
                disabled={limiteAtingido}
                className="brand-button pressable group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {limiteAtingido
                  ? "Limite atingido"
                  : foiAdicionado
                    ? "Adicionado ✓"
                    : "Pedir agora"}

                {!limiteAtingido && !foiAdicionado && (
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* BENEFÍCIOS */}
          <div className="animate-slide-up delay-4 mt-7 flex flex-wrap gap-2.5">
            <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-300 sm:text-xs">
              <span>⚡</span>
              Entrega rápida
            </div>

            <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-300 sm:text-xs">
              <span>❄️</span>
              Bebida gelada
            </div>

            <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-zinc-300 sm:text-xs">
              <span>🔥</span>
              Em promoção
            </div>
          </div>
        </div>

        {/* VISUAL */}
        <div className="animate-scale-in delay-3 relative flex min-h-[245px] items-center justify-center md:min-h-[360px]">
          <div
            aria-hidden="true"
            className="absolute h-[235px] w-[235px] rounded-full border border-amber-300/10 sm:h-[280px] sm:w-[280px] md:h-[330px] md:w-[330px]"
          />

          <div
            aria-hidden="true"
            className="absolute h-[190px] w-[190px] rounded-full border border-white/[0.06] sm:h-[230px] sm:w-[230px] md:h-[275px] md:w-[275px]"
          />

          <div
            aria-hidden="true"
            className="animate-pulse-glow absolute h-44 w-44 rounded-full bg-blue-500/15 blur-3xl sm:h-56 sm:w-56"
          />

          <div className="premium-card animate-float relative flex h-[190px] w-[190px] items-center justify-center overflow-hidden rounded-[40px] border border-violet-300/10 bg-gradient-to-br from-white/[0.07] via-white/[0.035] to-violet-500/[0.04] backdrop-blur-xl shadow-[0_30px_80px_rgba(37,99,235,0.10),0_20px_60px_rgba(139,92,246,0.08)] sm:h-[225px] sm:w-[225px] md:h-[270px] md:w-[270px]">
            {/* LUZ INTERNA */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.08] blur-3xl"
            />

            {/* REFLEXO */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[1px] rounded-[39px] bg-gradient-to-br from-white/[0.12] via-transparent to-violet-400/[0.05]"
            />

            {/* LINHA DE LUZ */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[15%] right-[15%] top-0 h-px bg-gradient-to-r from-transparent via-violet-200/30 to-transparent"
            />

            {produto.imagem_url ? (
              <Image
                src={produto.imagem_url}
                alt={produto.nome}
                fill
                sizes="(max-width: 640px) 190px, (max-width: 768px) 225px, 270px"
                quality={60}
                className="z-10 object-contain p-4 drop-shadow-[0_24px_32px_rgba(0,0,0,0.55)] transition duration-500 hover:scale-[1.04]"
              />
            ) : (
              <span className="relative z-10 text-[90px] drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)]">
                🍺
              </span>
            )}
          </div>

          {desconto > 0 && (
            <div className="glass absolute left-0 top-5 rounded-2xl px-3 py-2.5 shadow-xl sm:left-4 md:left-0 md:top-12">
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
                Economia
              </p>

              <p className="mt-0.5 text-sm font-black text-emerald-400">
                {desconto}% OFF
              </p>
            </div>
          )}

          <div className="glass absolute bottom-5 right-0 rounded-2xl px-3 py-2.5 shadow-xl sm:right-4 md:bottom-12 md:right-0">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-400 sm:text-sm">
              Disponível ✓
            </p>
          </div>
        </div>
      </div>

      {/* CONTROLES */}
      {produtos.length > 1 && (
        <>
          <button
            type="button"
            onClick={anterior}
            aria-label="Promoção anterior"
            className="pressable absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-violet-400/10 bg-zinc-950/70 text-lg font-black text-white backdrop-blur-xl transition hover:border-violet-400/40 hover:bg-violet-400/[0.08] hover:text-violet-300"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={proximo}
            aria-label="Próxima promoção"
            className="pressable absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-950/70 text-lg font-black text-white backdrop-blur-xl transition hover:border-violet-400/40 hover:bg-violet-400/[0.08] hover:text-violet-300 sm:right-5"
          >
            ›
          </button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {produtos.map((item, indice) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndiceAtual(indice)}
                aria-label={`Ir para promoção ${indice + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  indice === indiceAtual
                    ? "w-7 bg-amber-400"
                    : "w-2 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}

      <div className="section-divider absolute bottom-0 left-[8%] right-[8%]" />
    </section>
  );
}

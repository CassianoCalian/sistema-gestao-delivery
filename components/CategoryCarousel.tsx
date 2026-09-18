"use client";

import Link from "next/link";
import { PointerEvent, useRef } from "react";

type Categoria = {
  id: number;
  nome: string;
  slug: string;
  icone: string | null;
  descricao: string | null;
};

type CategoryCarouselProps = {
  categorias: Categoria[];
};

const destaques = [
  "bg-amber-400/10 border-amber-400/15",
  "bg-orange-400/10 border-orange-400/15",
  "bg-yellow-300/10 border-yellow-300/15",
  "bg-sky-400/10 border-sky-400/15",
  "bg-blue-400/10 border-blue-400/15",
  "bg-cyan-300/10 border-cyan-300/15",
  "bg-violet-400/10 border-violet-400/15",
  "bg-red-400/10 border-red-400/15",
  "bg-emerald-400/10 border-emerald-400/15",
  "bg-rose-400/10 border-rose-400/15",
];

export default function CategoryCarousel({
  categorias,
}: CategoryCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const arraste = useRef({
    ativo: false,
    inicioX: 0,
    scrollInicial: 0,
    moveu: false,
  });

  function iniciarArraste(
    event: PointerEvent<HTMLDivElement>,
  ) {
    if (event.pointerType !== "mouse") {
      return;
    }

    const elemento = containerRef.current;

    if (!elemento) {
      return;
    }

    arraste.current = {
      ativo: true,
      inicioX: event.clientX,
      scrollInicial: elemento.scrollLeft,
      moveu: false,
    };

    elemento.setPointerCapture(event.pointerId);
  }

  function mover(
    event: PointerEvent<HTMLDivElement>,
  ) {
    const elemento = containerRef.current;

    if (
      !elemento ||
      !arraste.current.ativo
    ) {
      return;
    }

    const diferenca =
      event.clientX - arraste.current.inicioX;

    if (Math.abs(diferenca) > 5) {
      arraste.current.moveu = true;
    }

    elemento.scrollLeft =
      arraste.current.scrollInicial -
      diferenca;
  }

  function finalizarArraste(
    event: PointerEvent<HTMLDivElement>,
  ) {
    const elemento = containerRef.current;

    if (!elemento) {
      return;
    }

    arraste.current.ativo = false;

    if (
      elemento.hasPointerCapture(
        event.pointerId,
      )
    ) {
      elemento.releasePointerCapture(
        event.pointerId,
      );
    }

    window.setTimeout(() => {
      arraste.current.moveu = false;
    }, 0);
  }

  function moverCarrossel(
    direcao: "esquerda" | "direita",
  ) {
    containerRef.current?.scrollBy({
      left:
        direcao === "direita"
          ? 520
          : -520,
      behavior: "smooth",
    });
  }

  return (
    <>
      <div className="mb-3 hidden justify-end gap-2 md:flex">
        <button
          type="button"
          onClick={() =>
            moverCarrossel("esquerda")
          }
          aria-label="Categorias anteriores"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-lg font-black text-zinc-400 transition hover:border-amber-400/30 hover:text-amber-400"
        >
          {"\u2190"}
        </button>

        <button
          type="button"
          onClick={() =>
            moverCarrossel("direita")
          }
          aria-label="Próximas categorias"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.025] text-lg font-black text-zinc-400 transition hover:border-amber-400/30 hover:text-amber-400"
        >
          {"\u2192"}
        </button>
      </div>

      <div
        ref={containerRef}
        onPointerDown={iniciarArraste}
        onPointerMove={mover}
        onPointerUp={finalizarArraste}
        onPointerCancel={finalizarArraste}
        className="-mx-4 cursor-grab overflow-x-auto scroll-smooth px-4 pb-4 active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:-mx-2 lg:px-2"
      >
        <div className="flex w-max snap-x snap-mandatory gap-3 sm:gap-4">
          {categorias.map(
            (categoria, index) => (
              <Link
                key={categoria.id}
                href={`/?categoria=${categoria.slug}#produtos`}
                draggable={false}
                onClick={(event) => {
                  if (arraste.current.moveu) {
                    event.preventDefault();
                  }
                }}
                className={`premium-card interactive-card group relative w-[152px] shrink-0 snap-start overflow-hidden rounded-[24px] border p-4 sm:w-[170px] sm:p-5 lg:w-[185px] ${
                  destaques[
                    index %
                      destaques.length
                  ]
                } animate-slide-up`}
                style={{
                  animationDelay: `${index * 70}ms`,
                }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/[0.035] blur-2xl transition duration-500 group-hover:scale-150"
                />

                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20 text-[30px] shadow-inner transition duration-300 group-hover:-rotate-3 group-hover:scale-110 sm:h-16 sm:w-16 sm:text-4xl">
                  {categoria.icone ||
                    "\u{1F6CD}\uFE0F"}
                </div>

                <div className="relative mt-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-black tracking-[-0.02em] text-white transition group-hover:text-amber-300 sm:text-base">
                      {categoria.nome}
                    </h3>

                    <span className="text-sm text-zinc-600 transition duration-300 group-hover:translate-x-1 group-hover:text-amber-400">
                      {"\u2192"}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[11px] font-medium leading-4 text-zinc-500 sm:text-xs">
                    {categoria.descricao ||
                      "Confira nossas opções"}
                  </p>
                </div>

                <div className="absolute bottom-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
              </Link>
            ),
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-2">
        <span className="h-1 w-6 rounded-full bg-amber-400" />

        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
          Arraste para explorar
        </span>
      </div>
    </>
  );
}

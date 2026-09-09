export default function HeroBanner() {
  return (
    <section className="animate-fade-in relative mt-6 overflow-hidden rounded-[28px] border border-white/[0.08] bg-zinc-950 shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:mt-8 md:rounded-[36px]">
      {/* LUZES DE FUNDO */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-amber-400/20 blur-[90px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-orange-600/20 blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[40%] top-[20%] h-48 w-48 rounded-full bg-red-600/10 blur-[90px]"
      />

      {/* GRADE DECORATIVA */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
        }}
      />

      {/* CONTEÚDO */}
      <div className="relative grid min-h-[530px] items-center gap-8 px-5 py-7 sm:px-7 sm:py-9 md:min-h-[470px] md:grid-cols-[1.08fr_0.92fr] md:px-12 md:py-12 lg:px-16">
        {/* TEXTO */}
        <div className="relative z-10">
          {/* BADGE */}
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/[0.09] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-300 backdrop-blur-md sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              Oferta do Zé
            </span>
          </div>

          {/* TÍTULO */}
          <div className="animate-slide-up delay-1">
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-zinc-500 sm:text-sm">
              Seu rolê começa aqui
            </p>

            <h1 className="mt-2 max-w-xl text-[38px] font-black leading-[0.96] tracking-[-0.045em] text-white sm:text-5xl md:text-[54px] lg:text-[64px]">
              O combo que
              <span className="brand-gradient-text block">salva a noite.</span>
            </h1>
          </div>

          {/* DESCRIÇÃO */}
          <p className="animate-slide-up delay-2 mt-5 max-w-lg text-[15px] font-medium leading-6 text-zinc-400 sm:text-base sm:leading-7">
            5 unidades de GT, 5 gelos de coco e 5 copos de 500ml. Tudo pronto
            para você só aproveitar.
          </p>

          {/* PREÇO + CTA */}
          <div className="animate-slide-up delay-3 mt-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    Dinheiro ou Pix
                  </span>

                  <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-400">
                    Oferta
                  </span>
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-sm font-bold text-zinc-500">R$</span>

                  <span className="text-[46px] font-black leading-none tracking-[-0.05em] text-white sm:text-5xl">
                    46
                  </span>

                  <span className="mb-1 text-xl font-black text-white">
                    ,00
                  </span>
                </div>
              </div>

              <a
                href="#produtos"
                className="brand-button pressable group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-[0.06em] sm:w-auto"
              >
                Pedir agora
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>
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
              <span>💳</span>
              Pix e dinheiro
            </div>
          </div>
        </div>

        {/* VISUAL DO COMBO */}
        <div className="animate-scale-in delay-3 relative flex min-h-[245px] items-center justify-center md:min-h-[360px]">
          {/* CÍRCULO EXTERNO */}
          <div
            aria-hidden="true"
            className="absolute h-[235px] w-[235px] rounded-full border border-amber-300/10 sm:h-[280px] sm:w-[280px] md:h-[330px] md:w-[330px]"
          />

          <div
            aria-hidden="true"
            className="absolute h-[190px] w-[190px] rounded-full border border-white/[0.06] sm:h-[230px] sm:w-[230px] md:h-[275px] md:w-[275px]"
          />

          {/* GLOW CENTRAL */}
          <div
            aria-hidden="true"
            className="animate-pulse-glow absolute h-40 w-40 rounded-full bg-amber-400/10 blur-3xl sm:h-52 sm:w-52"
          />

          {/* CARD CENTRAL */}
          <div className="premium-card animate-float relative flex h-[180px] w-[180px] flex-col items-center justify-center rounded-[40px] bg-white/[0.04] backdrop-blur-xl sm:h-[215px] sm:w-[215px] md:h-[250px] md:w-[250px]">
            <div className="absolute inset-[1px] rounded-[39px] bg-gradient-to-br from-white/[0.08] to-transparent" />

            <div className="relative text-[72px] drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)] sm:text-[88px] md:text-[100px]">
              🍹
            </div>

            <div className="relative mt-1 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 sm:text-xs">
                Combo GT
              </p>

              <p className="mt-1 text-[10px] font-medium text-zinc-500 sm:text-xs">
                Completo • Gelado
              </p>
            </div>
          </div>

          {/* CARD FLUTUANTE 1 */}
          <div className="glass absolute left-0 top-5 animate-slide-up rounded-2xl px-3 py-2.5 shadow-xl sm:left-4 md:left-0 md:top-12">
            <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
              Você leva
            </p>

            <p className="mt-0.5 text-xs font-black text-white sm:text-sm">
              15 itens 🔥
            </p>
          </div>

          {/* CARD FLUTUANTE 2 */}
          <div className="glass absolute bottom-5 right-0 animate-slide-up delay-4 rounded-2xl px-3 py-2.5 shadow-xl sm:right-4 md:bottom-12 md:right-0">
            <p className="text-[9px] font-black uppercase tracking-wider text-zinc-500">
              Pagamento
            </p>

            <p className="mt-0.5 text-xs font-black text-emerald-400 sm:text-sm">
              Pix ✓
            </p>
          </div>

          {/* PONTOS DECORATIVOS */}
          <div
            aria-hidden="true"
            className="absolute right-[13%] top-[12%] h-2 w-2 animate-pulse rounded-full bg-amber-400"
          />

          <div
            aria-hidden="true"
            className="absolute bottom-[15%] left-[16%] h-1.5 w-1.5 rounded-full bg-orange-500"
          />
        </div>
      </div>

      {/* LINHA INFERIOR */}
      <div className="section-divider absolute bottom-0 left-[8%] right-[8%]" />
    </section>
  );
}

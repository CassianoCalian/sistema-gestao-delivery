import Link from "next/link";

const categorias = [
  {
    nome: "Cervejas",
    slug: "cervejas",
    icone: "🍺",
    descricao: "Geladas e trincando",
    destaque: "bg-amber-400/10 border-amber-400/15",
  },
  {
    nome: "Destilados",
    slug: "destilados",
    icone: "🥃",
    descricao: "Para todos os brindes",
    destaque: "bg-orange-400/10 border-orange-400/15",
  },
  {
    nome: "Combos",
    slug: "combos",
    icone: "🔥",
    descricao: "Mais por menos",
    destaque: "bg-red-400/10 border-red-400/15",
  },
  {
    nome: "Energéticos",
    slug: "energeticos",
    icone: "⚡",
    descricao: "Energia pra noite",
    destaque: "bg-yellow-300/10 border-yellow-300/15",
  },
  {
    nome: "Refrigerantes",
    slug: "refrigerantes",
    icone: "🥤",
    descricao: "Sempre geladinhos",
    destaque: "bg-sky-400/10 border-sky-400/15",
  },
  {
    nome: "Gelos",
    slug: "gelos",
    icone: "🧊",
    descricao: "Do jeito que precisa",
    destaque: "bg-cyan-300/10 border-cyan-300/15",
  },
];

export default function Categories() {
  return (
    <section className="py-10 md:py-14">
      {/* CABEÇALHO */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="animate-slide-up">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-7 bg-amber-400" />

            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400 sm:text-xs">
              Encontre mais rápido
            </p>
          </div>

          <h2 className="text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
            Escolha sua
            <span className="brand-gradient-text"> categoria</span>
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Chegue mais rápido no que você está procurando.
          </p>
        </div>

        <div className="hidden items-center gap-2 text-xs font-bold text-zinc-600 md:flex">
          <span>Explorar</span>
          <span>→</span>
        </div>
      </div>

      {/* MOBILE: SCROLL HORIZONTAL / DESKTOP: GRID */}
      <div className="-mx-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
        <div className="flex snap-x snap-mandatory gap-3 lg:grid lg:grid-cols-6 lg:gap-4">
          {categorias.map((categoria, index) => (
            <Link
              key={categoria.slug}
              href={`/?categoria=${categoria.slug}#produtos`}
              className={`premium-card interactive-card group relative min-w-[152px] snap-start overflow-hidden rounded-[24px] border p-4 sm:min-w-[170px] sm:p-5 lg:min-w-0 ${
                categoria.destaque
              } animate-slide-up`}
              style={{
                animationDelay: `${index * 70}ms`,
              }}
            >
              {/* LUZ DECORATIVA */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/[0.035] blur-2xl transition duration-500 group-hover:scale-150"
              />

              {/* ÍCONE */}
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20 text-[30px] shadow-inner backdrop-blur-sm transition duration-300 group-hover:-rotate-3 group-hover:scale-110 sm:h-16 sm:w-16 sm:text-4xl">
                {categoria.icone}
              </div>

              {/* TEXTO */}
              <div className="relative mt-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-black tracking-[-0.02em] text-white transition group-hover:text-amber-300 sm:text-base">
                    {categoria.nome}
                  </h3>

                  <span className="translate-x-0 text-sm text-zinc-600 transition duration-300 group-hover:translate-x-1 group-hover:text-amber-400">
                    →
                  </span>
                </div>

                <p className="mt-1.5 text-[11px] font-medium leading-4 text-zinc-500 sm:text-xs">
                  {categoria.descricao}
                </p>
              </div>

              {/* LINHA INFERIOR */}
              <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </Link>
          ))}
        </div>
      </div>

      {/* INDICAÇÃO MOBILE */}
      <div className="mt-3 flex items-center justify-center gap-2 lg:hidden">
        <span className="h-1 w-6 rounded-full bg-amber-400" />
        <span className="h-1 w-1 rounded-full bg-zinc-700" />
        <span className="h-1 w-1 rounded-full bg-zinc-700" />

        <span className="ml-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600">
          Arraste
        </span>
      </div>
    </section>
  );
}

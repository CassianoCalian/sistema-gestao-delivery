import Header from "../components/Header";
import HeroBanner from "../components/HeroBanner";
import Categories from "../components/Categories";
import ProductSection from "../components/ProductSection";
import Footer from "../components/Footer";

type HomeProps = {
  searchParams: Promise<{
    categoria?: string;
    busca?: string;
    todos?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const parametros = await searchParams;

  const categoriaSelecionada = parametros.categoria?.trim() ?? "";

  const busca = parametros.busca?.trim() ?? "";
  const mostrarTodos = parametros.todos === "1";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <Header buscaAtual={busca} />

      <div className="mx-auto max-w-7xl px-6">
        {/* BUSCA MOBILE */}
        <form
          action="/#produtos"
          method="GET"
          className="animate-slide-up relative mt-5 md:hidden"
        >
          <div className="group relative flex overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.035] shadow-[0_12px_35px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-300 focus-within:border-amber-400/35 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_4px_rgba(251,191,36,0.04)]">
            <div className="flex items-center pl-4 text-zinc-600 transition group-focus-within:text-amber-400">
              <span className="text-lg">⌕</span>
            </div>

            <input
              type="text"
              name="busca"
              defaultValue={busca}
              placeholder="O que você está procurando?"
              className="min-w-0 flex-1 bg-transparent px-3 py-4 text-[13px] font-medium text-white placeholder:text-zinc-600"
            />

            <button
              type="submit"
              aria-label="Buscar produtos"
              className="pressable m-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-base font-black text-zinc-950 shadow-[0_8px_24px_rgba(245,158,11,0.2)]"
            >
              →
            </button>
          </div>

          <div className="pointer-events-none absolute -bottom-px left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-amber-400/15 to-transparent" />
        </form>

        <HeroBanner />

        <Categories />

        <ProductSection
          categoriaSelecionada={categoriaSelecionada}
          busca={busca}
          mostrarTodos={mostrarTodos}
        />
      </div>

      <Footer />
    </main>
  );
}

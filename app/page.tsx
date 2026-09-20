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
    <main
      className="relative min-h-screen overflow-hidden bg-[#070707] text-white"
      style={{
        backgroundImage: `
      radial-gradient(circle at 50% 8%, rgba(245,158,11,0.13), transparent 26%),
      radial-gradient(circle at 8% 38%, rgba(249,115,22,0.07), transparent 24%),
      radial-gradient(circle at 92% 58%, rgba(245,158,11,0.065), transparent 26%),
      radial-gradient(circle at 40% 88%, rgba(234,88,12,0.045), transparent 28%),
      linear-gradient(180deg, #080808 0%, #0b0907 45%, #070707 100%)
    `,
      }}
    >
      {/* PARTÍCULAS DECORATIVAS DO FUNDO */}
      <div
        aria-hidden="true"
        className="mobile-static-particles pointer-events-none fixed inset-0 z-20 overflow-hidden"
      >
        <span
          className="absolute left-[4%] top-[18%] h-2.5 w-2.5 rounded-full border border-amber-300/40 bg-amber-300/10 shadow-[0_0_12px_rgba(252,211,77,0.25)]"
          style={{ animation: "admin-float 5s ease-in-out infinite" }}
        />

        <span
          className="absolute right-[5%] top-[28%] h-4 w-4 rounded-full border border-amber-300/30 bg-amber-300/[0.06] shadow-[0_0_14px_rgba(252,211,77,0.18)]"
          style={{
            animation: "admin-float 7s ease-in-out infinite",
            animationDelay: "1s",
          }}
        />

        <span
          className="absolute left-[7%] top-[47%] h-1.5 w-1.5 rounded-full bg-amber-300/40 shadow-[0_0_10px_rgba(252,211,77,0.3)]"
          style={{
            animation: "admin-float 4s ease-in-out infinite",
            animationDelay: "0.5s",
          }}
        />

        <span
          className="absolute right-[6%] top-[58%] h-3 w-3 rounded-full border border-orange-300/30"
          style={{
            animation: "admin-float 6s ease-in-out infinite",
            animationDelay: "2s",
          }}
        />

        <span
          className="absolute left-[5%] top-[72%] h-4 w-4 rounded-full border border-amber-300/25 bg-amber-300/[0.04]"
          style={{
            animation: "admin-float 8s ease-in-out infinite",
            animationDelay: "1.5s",
          }}
        />

        <span
          className="absolute right-[8%] top-[84%] h-2 w-2 rounded-full bg-orange-300/30 shadow-[0_0_10px_rgba(253,186,116,0.25)]"
          style={{
            animation: "admin-float 5s ease-in-out infinite",
            animationDelay: "2.5s",
          }}
        />
      </div>
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

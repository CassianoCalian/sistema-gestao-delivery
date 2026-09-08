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
        <form action="/#produtos" method="GET" className="mt-6 flex md:hidden">
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="O que você está procurando?"
            className="w-full rounded-l-xl border border-r-0 border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
          />

          <button
            type="submit"
            className="rounded-r-xl bg-amber-400 px-5 font-black text-zinc-950"
          >
            🔎
          </button>
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

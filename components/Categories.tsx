import CategoryCarousel from "./CategoryCarousel";

import { supabaseAdmin } from "../lib/supabaseAdmin";

export default async function Categories() {
  const { data, error } = await supabaseAdmin
    .from("categorias")
    .select(`
      id,
      nome,
      slug,
      icone,
      descricao,
      ordem
    `)
    .eq("ativo", true)
    .order("ordem", {
      ascending: true,
    })
    .order("nome", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Erro ao carregar categorias da loja:",
      error,
    );
  }

  const categorias = data ?? [];

  if (categorias.length === 0) {
    return null;
  }

  return (
    <section
      id="categorias"
      className="relative isolate scroll-mt-24 py-10 md:py-14"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-6 top-4 -z-10 h-[82%] rounded-[36px] bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.10),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_75%)]"
      />

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
            <span className="brand-gradient-text">
              {" "}
              categoria
            </span>
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Chegue mais rápido no que você está procurando.
          </p>
        </div>
      </div>

      <CategoryCarousel
        categorias={categorias.map(
          (categoria) => ({
            id: Number(categoria.id),
            nome: categoria.nome,
            slug: categoria.slug,
            icone: categoria.icone,
            descricao:
              categoria.descricao,
          }),
        )}
      />
    </section>
  );
}

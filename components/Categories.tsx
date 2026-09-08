import Link from "next/link";

const categorias = [
  { nome: "Cervejas", slug: "cervejas", icone: "🍺" },
  { nome: "Destilados", slug: "destilados", icone: "🥃" },
  { nome: "Combos", slug: "combos", icone: "🔥" },
  { nome: "Energéticos", slug: "energeticos", icone: "⚡" },
  { nome: "Refrigerantes", slug: "refrigerantes", icone: "🥤" },
  { nome: "Gelos", slug: "gelos", icone: "🧊" },
];

export default function Categories() {
  return (
    <section className="py-12">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
          Encontre mais rápido
        </p>

        <h2 className="mt-1 text-3xl font-black">Categorias</h2>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {categorias.map((categoria) => (
          <Link
            key={categoria.slug}
            href={`/?categoria=${categoria.slug}#produtos`}
            className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left transition hover:-translate-y-1 hover:border-amber-400"
          >
            <span className="text-4xl">{categoria.icone}</span>

            <p className="mt-4 font-bold group-hover:text-amber-400">
              {categoria.nome}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

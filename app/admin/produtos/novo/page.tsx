import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import NewProductForm from "../../../../components/NewProductForm";

export default async function NovoProdutoPage() {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const { data: categorias, error } = await supabaseAdmin
    .from("categorias")
    .select(
      `
      id,
      nome,
      slug
    `,
    )
    .eq("ativo", true)
    .neq("slug", "promocoes")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("Erro ao carregar categorias:", error);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/admin/produtos"
          className="text-sm font-bold text-amber-400"
        >
          ← Voltar para produtos
        </Link>

        <div className="mt-8">
          <p className="text-sm font-black uppercase tracking-widest text-amber-400">
            Depósito do Zé
          </p>

          <h1 className="mt-2 text-4xl font-black">Novo produto</h1>

          <p className="mt-2 text-zinc-400">
            Cadastre um novo produto para aparecer na loja.
          </p>
        </div>

        <NewProductForm categorias={categorias ?? []} />
      </div>
    </main>
  );
}

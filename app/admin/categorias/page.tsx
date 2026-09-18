import { redirect } from "next/navigation";

import AdminNavigation from "../../../components/AdminNavigation";
import CategoryAdminForm from "../../../components/CategoryAdminForm";
import CategoryListManager from "../../../components/CategoryListManager";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../lib/supabase/requireAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCategoriasPage() {
  const autorizado =
    await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const [
    categoriasResultado,
    produtosResultado,
  ] = await Promise.all([
    supabaseAdmin
      .from("categorias")
      .select(`
        id,
        nome,
        slug,
        icone,
        descricao,
        ativo,
        ordem
      `)
      .order("ordem", {
        ascending: true,
      })
      .order("nome", {
        ascending: true,
      }),

    supabaseAdmin
      .from("produtos")
      .select("categoria_id"),
  ]);

  if (
    categoriasResultado.error
  ) {
    console.error(
      "Erro ao carregar categorias:",
      categoriasResultado.error,
    );
  }

  if (produtosResultado.error) {
    console.error(
      "Erro ao carregar produtos das categorias:",
      produtosResultado.error,
    );
  }

  const categorias =
    categoriasResultado.data ?? [];

  const quantidadeProdutos =
    new Map<number, number>();

  for (
    const produto of
      produtosResultado.data ?? []
  ) {
    if (
      produto.categoria_id === null
    ) {
      continue;
    }

    const categoriaId = Number(
      produto.categoria_id,
    );

    quantidadeProdutos.set(
      categoriaId,
      (quantidadeProdutos.get(
        categoriaId,
      ) ?? 0) + 1,
    );
  }

  const categoriasComQuantidade =
    categorias.map(
      (categoria) => ({
        id: Number(categoria.id),
        nome: categoria.nome,
        slug: categoria.slug,
        icone:
          categoria.icone ?? null,
        descricao:
          categoria.descricao ?? null,
        ativo: Boolean(
          categoria.ativo,
        ),
        ordem: Number(
          categoria.ordem ?? 0,
        ),
        quantidadeProdutos:
          quantidadeProdutos.get(
            Number(categoria.id),
          ) ?? 0,
      }),
    );

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Catálogo
            </p>

            <h1 className="mt-2 text-4xl font-black tracking-[-0.035em]">
              Categorias
            </h1>

            <p className="mt-2 max-w-2xl text-zinc-400">
              Adicione e edite as categorias utilizadas na loja.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-600">
              Total
            </p>

            <p className="mt-1 text-3xl font-black text-amber-400">
              {categorias.length}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          <CategoryAdminForm />

          <section className="rounded-[24px] border border-white/[0.07] bg-zinc-900 p-5 sm:p-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                Categorias cadastradas
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Catálogo atual
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Altere nome, ícone ou descrição sem precisar modificar o código.
              </p>
            </div>

            <div className="mt-6">
              <CategoryListManager
                categorias={
                  categoriasComQuantidade
                }
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

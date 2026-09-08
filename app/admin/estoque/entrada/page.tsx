import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";

import AdminNavigation from "../../../../components/AdminNavigation";
import EntradaEstoqueForm from "../../../../components/EntradaEstoqueForm";

export const dynamic = "force-dynamic";

export default async function EntradaEstoquePage() {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select("id, nome, estoque, ativo")
    .order("nome", {
      ascending: true,
    });

  if (error) {
    console.error("Erro ao carregar produtos:", error);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <AdminNavigation />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Controle de estoque
            </p>

            <h1 className="mt-2 text-4xl font-black">Entrada de mercadoria</h1>

            <p className="mt-2 text-zinc-400">
              Registre novas unidades recebidas no estoque.
            </p>
          </div>

          <Link
            href="/admin/estoque/movimentacoes"
            className="font-bold text-amber-400 transition hover:text-amber-300"
          >
            📊 Ver histórico
          </Link>
        </div>

        {error ? (
          <div className="mt-8 rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-400">
            Não foi possível carregar os produtos.
          </div>
        ) : (
          <EntradaEstoqueForm
            produtos={(produtos ?? []).map((produto) => ({
              id: Number(produto.id),
              nome: produto.nome,
              estoque: Number(produto.estoque),
              ativo: Boolean(produto.ativo),
            }))}
          />
        )}
      </div>
    </main>
  );
}

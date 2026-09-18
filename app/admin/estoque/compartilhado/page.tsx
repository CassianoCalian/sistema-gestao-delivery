import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import AdminNavigation from "../../../../components/AdminNavigation";
import EstoqueCompartilhadoForm from "../../../../components/EstoqueCompartilhadoForm";

export const dynamic = "force-dynamic";

export default async function EstoqueCompartilhadoPage() {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const [
    { data: produtos, error: erroProdutos },
    { data: estoques, error: erroEstoques },
    { data: configuracoes, error: erroConfiguracoes },
  ] = await Promise.all([
    supabaseAdmin
      .from("produtos")
      .select("id, nome, ativo")
      .order("nome", { ascending: true }),

    supabaseAdmin
      .from("estoques_compartilhados")
      .select("id, nome, quantidade_total")
      .order("nome", { ascending: true }),

    supabaseAdmin
      .from("produto_estoque_config")
      .select("produto_id, estoque_compartilhado_id, quantidade_por_venda"),
  ]);

  const erro = erroProdutos || erroEstoques || erroConfiguracoes;

  if (erro) {
    console.error("Erro ao carregar estoques compartilhados:", erro);

    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <AdminNavigation />

          <div className="mt-8 rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-400">
            Não foi possível carregar os estoques físicos.
          </div>
        </div>
      </main>
    );
  }

  const nomeEstoquePorId = new Map(
    (estoques ?? []).map((estoque) => [Number(estoque.id), estoque.nome]),
  );

  const configuracaoPorProduto = new Map(
    (configuracoes ?? []).map((configuracao) => [
      Number(configuracao.produto_id),
      {
        estoque_compartilhado_id: Number(configuracao.estoque_compartilhado_id),
      },
    ]),
  );

  const produtosFormatados = (produtos ?? []).map((produto) => {
    const configuracao = configuracaoPorProduto.get(Number(produto.id));

    const estoqueCompartilhadoId =
      configuracao?.estoque_compartilhado_id ?? null;

    return {
      id: Number(produto.id),
      nome: produto.nome,
      ativo: Boolean(produto.ativo),
      estoque_compartilhado_id: estoqueCompartilhadoId,
      estoque_compartilhado_nome:
        estoqueCompartilhadoId !== null
          ? (nomeEstoquePorId.get(estoqueCompartilhadoId) ?? null)
          : null,
    };
  });

  const estoquesFormatados = (estoques ?? []).map((estoque) => ({
    id: Number(estoque.id),
    nome: estoque.nome,
    quantidade_total: Number(estoque.quantidade_total),

    vinculos: (configuracoes ?? [])
      .filter(
        (configuracao) =>
          Number(configuracao.estoque_compartilhado_id) === Number(estoque.id),
      )
      .map((configuracao) => ({
        produto_id: Number(configuracao.produto_id),
        quantidade_por_venda: Number(configuracao.quantidade_por_venda),
      })),
  }));

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Controle de estoque
            </p>

            <h1 className="mt-2 text-4xl font-black">Estoque compartilhado</h1>

            <p className="mt-2 max-w-3xl text-zinc-400">
              Controle unidade, promoção, pack e fardo usando uma única
              quantidade física real.
            </p>
          </div>

          <Link
            href="/admin/estoque"
            className="font-bold text-amber-400 transition hover:text-amber-300"
          >
            ← Voltar ao estoque
          </Link>
        </div>

        <EstoqueCompartilhadoForm
          produtos={produtosFormatados}
          estoques={estoquesFormatados}
        />
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import EditProductForm from "../../../../components/EditProductForm";

type EditarProdutoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditarProdutoPage({
  params,
}: EditarProdutoPageProps) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const { id } = await params;

  const produtoId = Number(id);

  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    notFound();
  }

  const { data: produto, error } = await supabaseAdmin
    .from("produtos")
    .select(
      `
      id,
      nome,
      descricao,
      preco,
      preco_promocional,
      imagem_url,
      estoque,
estoque_minimo,
unidades_por_item,
ativo,
      destaque,
      em_promocao,
      permite_abaixo_minimo,
       categoria_id
    `,
    )
    .eq("id", produtoId)
    .single();

  if (error || !produto) {
    notFound();
  }

  const { data: opcoesProduto, error: erroOpcoes } = await supabaseAdmin
    .from("produto_opcoes")
    .select("id, nome, ativo, ordem")
    .eq("produto_id", produtoId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("id", { ascending: true });

  if (erroOpcoes) {
    console.error("Erro ao carregar opções do produto:", erroOpcoes);
  }

  const { data: categorias } = await supabaseAdmin
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

          <h1 className="mt-2 text-4xl font-black">Editar produto</h1>

          <p className="mt-2 text-zinc-400">
            Altere preço, estoque, promoção e disponibilidade.
          </p>
        </div>

        <EditProductForm
          categorias={categorias ?? []}
          produto={{
            id: produto.id,
            nome: produto.nome,
            descricao: produto.descricao,
            preco: Number(produto.preco),

            preco_promocional:
              produto.preco_promocional !== null
                ? Number(produto.preco_promocional)
                : null,

            estoque: produto.estoque,
            estoque_minimo: Number(produto.estoque_minimo),
            unidades_por_item: Number(produto.unidades_por_item ?? 0),
            ativo: produto.ativo,
            imagem_url: produto.imagem_url,
            destaque: produto.destaque,
            em_promocao: produto.em_promocao,
            permite_abaixo_minimo: produto.permite_abaixo_minimo,

            categoria_id:
              produto.categoria_id !== null
                ? Number(produto.categoria_id)
                : null,
            opcoes: (opcoesProduto ?? []).map((opcao) => ({
              id: Number(opcao.id),
              nome: opcao.nome,
            })),
          }}
        />
      </div>
    </main>
  );
}

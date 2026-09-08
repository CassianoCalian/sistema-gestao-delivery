import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../lib/supabase/requireAdmin";
import AdminNavigation from "../../../components/AdminNavigation";
import AdminProductsAutoRefresh from "../../../components/AdminProductsAutoRefresh";

export const dynamic = "force-dynamic";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type AdminProdutosPageProps = {
  searchParams: Promise<{
    busca?: string;
    categoria?: string;
    estoque?: string;
  }>;
};

export default async function AdminProdutosPage({
  searchParams,
}: AdminProdutosPageProps) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const parametros = await searchParams;

  const busca = parametros.busca?.trim() ?? "";
  const categoriaSelecionada = parametros.categoria ?? "";
  const estoqueSelecionado = parametros.estoque ?? "";

  const { data: categorias } = await supabaseAdmin
    .from("categorias")
    .select("id, nome")
    .eq("ativo", true)
    .neq("slug", "promocoes")
    .order("ordem", { ascending: true });

  let consultaProdutos = supabaseAdmin
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
    ativo,
    em_promocao,
    categoria_id
  `,
    )
    .order("nome", { ascending: true });

  if (busca) {
    consultaProdutos = consultaProdutos.ilike("nome", `%${busca}%`);
  }

  const categoriaId = Number(categoriaSelecionada);

  if (Number.isInteger(categoriaId) && categoriaId > 0) {
    consultaProdutos = consultaProdutos.eq("categoria_id", categoriaId);
  }

  if (estoqueSelecionado === "esgotado") {
    consultaProdutos = consultaProdutos.eq("estoque", 0);
  }

  const { data: produtos, error } = await consultaProdutos;
  const { data: estoqueResumo } = await supabaseAdmin
    .from("produtos")
    .select("estoque, estoque_minimo, ativo");

  const quantidadeEstoqueBaixo =
    estoqueResumo?.filter(
      (produto) =>
        produto.ativo &&
        Number(produto.estoque) > 0 &&
        Number(produto.estoque) <= Number(produto.estoque_minimo),
    ).length ?? 0;

  const quantidadeEsgotados =
    estoqueResumo?.filter((produto) => produto.ativo && produto.estoque === 0)
      .length ?? 0;

  const categoriasPorId = new Map(
    (categorias ?? []).map((categoria) => [
      Number(categoria.id),
      categoria.nome,
    ]),
  );
  if (error) {
    console.error("Erro ao carregar produtos:", error);

    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <AdminProductsAutoRefresh />
        <div className="mx-auto max-w-6xl">
          <AdminNavigation />
          <p className="font-bold text-red-400">
            Não foi possível carregar os produtos.
          </p>
        </div>
      </main>
    );
  }

  const produtosFiltrados =
    estoqueSelecionado === "baixo"
      ? (produtos ?? []).filter(
          (produto) =>
            produto.ativo &&
            Number(produto.estoque) > 0 &&
            Number(produto.estoque) <= Number(produto.estoque_minimo),
        )
      : (produtos ?? []);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <AdminProductsAutoRefresh />
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />
        <div>
          <h1 className="text-4xl font-black">Produtos</h1>

          <p className="mt-2 text-zinc-400">
            Gerencie produtos, preços, estoque e promoções da loja.
          </p>
        </div>

        <form
          method="GET"
          className="mt-10 grid gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:grid-cols-[1fr_220px_200px_auto]"
        >
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="🔎 Buscar produto pelo nome..."
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          />

          <select
            name="categoria"
            defaultValue={categoriaSelecionada}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">Todas as categorias</option>

            {categorias?.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>

          <select
            name="estoque"
            defaultValue={estoqueSelecionado}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
          >
            <option value="">Todo o estoque</option>

            <option value="baixo">⚠️ Estoque baixo</option>

            <option value="esgotado">❌ Esgotados</option>
          </select>

          <button
            type="submit"
            className="rounded-xl bg-amber-400 px-6 py-3 font-black text-zinc-950 transition hover:bg-amber-300"
          >
            Filtrar
          </button>
        </form>

        {(busca || categoriaSelecionada || estoqueSelecionado) && (
          <div className="mt-3">
            <Link
              href="/admin/produtos"
              className="text-sm font-bold text-zinc-400 transition hover:text-amber-400"
            >
              ✕ Limpar filtros
            </Link>
          </div>
        )}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-orange-900/60 bg-orange-950/20 p-5">
            <p className="text-sm font-black text-orange-400">
              ⚠️ Estoque baixo
            </p>

            <p className="mt-2 text-3xl font-black">{quantidadeEstoqueBaixo}</p>

            <p className="mt-1 text-sm text-zinc-400">
              conforme o mínimo de cada produto
            </p>
          </div>

          <div className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5">
            <p className="text-sm font-black text-red-400">❌ Esgotados</p>

            <p className="mt-2 text-3xl font-black">{quantidadeEsgotados}</p>

            <p className="mt-1 text-sm text-zinc-400">produtos sem estoque</p>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            {produtosFiltrados.length} produtos encontrados
          </p>

          <Link
            href="/admin/produtos/novo"
            className="rounded-xl bg-amber-400 px-5 py-3 font-black text-zinc-950 transition hover:bg-amber-300"
          >
            + Novo produto
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {produtosFiltrados.map((produto) => (
            <div
              key={produto.id}
              className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div
                className="mb-4 flex h-36 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950"
                style={
                  produto.imagem_url
                    ? {
                        backgroundImage: `url(${produto.imagem_url})`,
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        backgroundSize: "contain",
                      }
                    : undefined
                }
              >
                {!produto.imagem_url && <span className="text-5xl">📦</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {!produto.ativo && (
                  <span className="rounded-full bg-red-950 px-2.5 py-1 text-xs font-black text-red-300">
                    Inativo
                  </span>
                )}

                {produto.em_promocao && (
                  <span className="rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-zinc-950">
                    🔥 Promoção
                  </span>
                )}
              </div>
              {produto.categoria_id && (
                <p className="mt-3 text-xs font-black uppercase tracking-wider text-amber-400">
                  {categoriasPorId.get(Number(produto.categoria_id)) ??
                    "Sem categoria"}
                </p>
              )}

              <h2 className="mt-2 text-lg font-black">{produto.nome}</h2>

              <div className="mt-4">
                {produto.em_promocao && produto.preco_promocional !== null ? (
                  <>
                    <p className="text-sm text-zinc-500 line-through">
                      {formatarPreco(Number(produto.preco))}
                    </p>

                    <p className="text-2xl font-black text-amber-400">
                      {formatarPreco(Number(produto.preco_promocional))}
                    </p>
                  </>
                ) : (
                  <p className="text-2xl font-black text-amber-400">
                    {formatarPreco(Number(produto.preco))}
                  </p>
                )}
                {produto.ativo && produto.estoque === 0 && (
                  <span className="rounded-full bg-red-950 px-2.5 py-1 text-xs font-black text-red-300">
                    ❌ Esgotado
                  </span>
                )}

                {produto.ativo &&
                  Number(produto.estoque) > 0 &&
                  Number(produto.estoque) <= Number(produto.estoque_minimo) && (
                    <span className="rounded-full bg-orange-950 px-2.5 py-1 text-xs font-black text-orange-300">
                      ⚠️ Estoque baixo
                    </span>
                  )}
              </div>

              <div className="mt-4 rounded-xl bg-zinc-950 p-3">
                <p className="text-xs text-zinc-500">Estoque atual</p>

                <p className="font-black">{produto.estoque} unidades</p>

                <p className="mt-1 text-xs text-zinc-500">
                  Mínimo: {produto.estoque_minimo}
                </p>
              </div>

              <Link
                href={`/admin/produtos/${produto.id}`}
                className="mt-4 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 text-center text-sm font-bold transition hover:border-amber-400 hover:text-amber-400"
              >
                ✏️ Editar produto
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

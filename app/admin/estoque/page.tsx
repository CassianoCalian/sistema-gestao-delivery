import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../lib/supabase/requireAdmin";
import AdminNavigation from "../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function AdminEstoquePage() {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const { data: produtos, error } = await supabaseAdmin
    .from("produtos")
    .select(
      `
      id,
      nome,
      estoque,
      estoque_minimo,
      ativo,
      preco,
      preco_promocional,
      em_promocao
    `,
    )
    .order("nome", {
      ascending: true,
    });

  if (error) {
    console.error("Erro ao carregar resumo de estoque:", error);

    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
        <div className="mx-auto max-w-6xl">
          <AdminNavigation />

          <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6 text-red-400">
            Não foi possível carregar o estoque.
          </div>
        </div>
      </main>
    );
  }

  const produtosAtivos = produtos?.filter((produto) => produto.ativo) ?? [];

  const quantidadeProdutosAtivos = produtosAtivos.length;

  const totalUnidades = produtosAtivos.reduce(
    (total, produto) => total + Number(produto.estoque),
    0,
  );

  const estoqueBaixo = produtosAtivos.filter(
    (produto) =>
      Number(produto.estoque) > 0 &&
      Number(produto.estoque) <= Number(produto.estoque_minimo),
  );

  const esgotados = produtosAtivos.filter(
    (produto) => Number(produto.estoque) === 0,
  );

  const valorPotencialEstoque = produtosAtivos.reduce((total, produto) => {
    const precoNormal = Number(produto.preco);

    const precoPromocional =
      produto.preco_promocional !== null
        ? Number(produto.preco_promocional)
        : null;

    const precoAtual =
      produto.em_promocao && precoPromocional !== null
        ? precoPromocional
        : precoNormal;

    return total + precoAtual * Number(produto.estoque);
  }, 0);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
              Controle de estoque
            </p>

            <h1 className="mt-2 text-4xl font-black">Visão geral</h1>

            <p className="mt-2 text-zinc-400">
              Acompanhe o estoque atual do Depósito do Zé.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/estoque/entrada"
              className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
            >
              📥 Registrar entrada
            </Link>

            <Link
              href="/admin/estoque/movimentacoes"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-sm font-black transition hover:border-amber-400 hover:text-amber-400"
            >
              📊 Ver histórico
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-black text-zinc-400">
              📦 Produtos ativos
            </p>

            <p className="mt-2 text-3xl font-black">
              {quantidadeProdutosAtivos}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-black text-zinc-400">
              🧮 Unidades em estoque
            </p>

            <p className="mt-2 text-3xl font-black">{totalUnidades}</p>
          </div>

          <Link
            href="/admin/produtos?estoque=baixo"
            className="rounded-2xl border border-orange-900/60 bg-orange-950/20 p-5 transition hover:border-orange-400"
          >
            <p className="text-sm font-black text-orange-400">
              ⚠️ Estoque baixo
            </p>

            <p className="mt-2 text-3xl font-black">{estoqueBaixo.length}</p>

            <p className="mt-1 text-xs text-zinc-500">
              conforme o mínimo de cada produto
            </p>
          </Link>

          <Link
            href="/admin/produtos?estoque=esgotado"
            className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5 transition hover:border-red-400"
          >
            <p className="text-sm font-black text-red-400">❌ Esgotados</p>

            <p className="mt-2 text-3xl font-black">{esgotados.length}</p>
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border border-green-900/60 bg-green-950/20 p-6">
          <p className="text-sm font-black text-green-400">
            💰 Valor potencial de venda do estoque
          </p>

          <p className="mt-2 text-4xl font-black">
            {formatarPreco(valorPotencialEstoque)}
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            Calculado pelo preço atual de venda dos produtos ativos.
          </p>
        </div>

        {(estoqueBaixo.length > 0 || esgotados.length > 0) && (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-black">
              Produtos que precisam de atenção
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[...esgotados, ...estoqueBaixo].map((produto) => (
                <Link
                  key={produto.id}
                  href={`/admin/produtos/${produto.id}`}
                  className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition hover:border-amber-400"
                >
                  <div>
                    <p className="font-black">{produto.nome}</p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Atual: {produto.estoque} • Mínimo:{" "}
                      {produto.estoque_minimo}
                    </p>
                  </div>

                  <span
                    className={`font-black ${
                      Number(produto.estoque) === 0
                        ? "text-red-400"
                        : "text-orange-400"
                    }`}
                  >
                    {produto.estoque}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

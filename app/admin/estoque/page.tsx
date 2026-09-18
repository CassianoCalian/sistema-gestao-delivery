import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../lib/supabase/requireAdmin";
import AdminNavigation from "../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

export default async function AdminEstoquePage() {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const [
    { data: produtos, error: erroProdutos },
    { data: configuracoesEstoque, error: erroConfiguracoesEstoque },
    { data: estoquesCompartilhados, error: erroEstoquesCompartilhados },
  ] = await Promise.all([
    supabaseAdmin
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
      }),

    supabaseAdmin.from("produto_estoque_config").select(
      `
          produto_id,
          estoque_compartilhado_id,
          quantidade_por_venda
        `,
    ),

    supabaseAdmin
      .from("estoques_compartilhados")
      .select(
        `
          id,
          nome,
          quantidade_total
        `,
      )
      .order("nome", {
        ascending: true,
      }),
  ]);

  if (erroProdutos || erroConfiguracoesEstoque || erroEstoquesCompartilhados) {
    console.error("Erro ao carregar resumo de estoque:", {
      erroProdutos,
      erroConfiguracoesEstoque,
      erroEstoquesCompartilhados,
    });

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

  /*
   * IDs dos produtos que utilizam estoque físico compartilhado.
   *
   * Esses produtos NÃO podem ser somados normalmente,
   * porque unidade, promoção e pack podem representar
   * o mesmo estoque físico.
   */
  const idsProdutosCompartilhados = new Set(
    (configuracoesEstoque ?? []).map((configuracao) =>
      Number(configuracao.produto_id),
    ),
  );

  /*
   * Soma somente produtos tradicionais, que possuem
   * estoque próprio e independente.
   */
  const totalUnidadesProdutosNormais = produtosAtivos
    .filter((produto) => !idsProdutosCompartilhados.has(Number(produto.id)))
    .reduce((total, produto) => total + Number(produto.estoque), 0);

  /*
   * Cada estoque compartilhado entra apenas uma vez,
   * usando sua quantidade física real.
   *
   * Exemplo:
   *
   * BRAHMA:
   * unidade = 240
   * promoção = 48
   * pack = 20
   *
   * Estoque físico = 240, e não 308.
   */
  const totalUnidadesCompartilhadas = (estoquesCompartilhados ?? []).reduce(
    (total, estoque) => total + Number(estoque.quantidade_total),
    0,
  );

  const totalUnidades =
    totalUnidadesProdutosNormais + totalUnidadesCompartilhadas;

  /*
   * Baixo estoque e esgotados continuam sendo
   * calculados por formato de venda.
   *
   * Para produtos compartilhados, produtos.estoque
   * já contém a quantidade derivada sincronizada.
   */
  const estoqueBaixo = produtosAtivos.filter(
    (produto) =>
      Number(produto.estoque) > 0 &&
      Number(produto.estoque) <= Number(produto.estoque_minimo),
  );

  const esgotados = produtosAtivos.filter(
    (produto) => Number(produto.estoque) === 0,
  );

  const quantidadeEstoquesCompartilhados = estoquesCompartilhados?.length ?? 0;

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
              href="/admin/estoque/compartilhado"
              className="rounded-xl border border-amber-400/40 bg-amber-400/5 px-5 py-3 text-sm font-black text-amber-400 transition hover:bg-amber-400/10"
            >
              🔗 Estoque compartilhado
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
              🧮 Unidades físicas em estoque
            </p>

            <p className="mt-2 text-3xl font-black">{totalUnidades}</p>

            <p className="mt-1 text-xs text-zinc-500">
              Sem duplicar unidade, promoção ou pack.
            </p>
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

        <Link
          href="/admin/estoque/compartilhado"
          className="mt-4 block rounded-2xl border border-amber-900/60 bg-amber-950/20 p-6 transition hover:border-amber-400"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-amber-400">
                🔗 Estoques físicos compartilhados
              </p>

              <p className="mt-2 text-4xl font-black text-white">
                {quantidadeEstoquesCompartilhados}
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Grupos físicos controlando unidade, promoção, pack e outros
                formatos de venda.
              </p>
            </div>

            <span className="text-sm font-black text-amber-400">
              Gerenciar →
            </span>
          </div>
        </Link>

        {(estoqueBaixo.length > 0 || esgotados.length > 0) && (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-black">
              Produtos que precisam de atenção
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[...esgotados, ...estoqueBaixo].map((produto) => (
                <div
                  key={produto.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-black">{produto.nome}</p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Atual: {produto.estoque} • Mínimo:{" "}
                        {produto.estoque_minimo}
                      </p>

                      {idsProdutosCompartilhados.has(Number(produto.id)) && (
                        <p className="mt-1 text-xs font-bold text-amber-400">
                          🔗 Estoque derivado de um grupo físico compartilhado
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-xl font-black ${
                        Number(produto.estoque) === 0
                          ? "text-red-400"
                          : "text-orange-400"
                      }`}
                    >
                      {produto.estoque}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/estoque/entrada?produto=${produto.id}`}
                      className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-black text-zinc-950 transition hover:bg-amber-300"
                    >
                      📥 Registrar entrada
                    </Link>

                    <Link
                      href={`/admin/produtos/${produto.id}`}
                      className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-black text-zinc-300 transition hover:border-amber-400 hover:text-amber-400"
                    >
                      ✏️ Editar produto
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

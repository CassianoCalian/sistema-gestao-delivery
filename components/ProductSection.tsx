import Link from "next/link";
import { supabase } from "../lib/supabase";
import AddToCartButton from "./AddToCartButton";

type Produto = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_promocional: number | null;
  imagem_url: string | null;
  estoque: number;
  destaque: boolean;
  em_promocao: boolean;

  categoria:
    | {
        nome: string;
      }
    | {
        nome: string;
      }[]
    | null;
};

function getIconeCategoria(categoria: string) {
  const icones: Record<string, string> = {
    Cervejas: "🍺",
    Destilados: "🥃",
    Energéticos: "⚡",
    Refrigerantes: "🥤",
    Águas: "💧",
    Gelos: "🧊",
    "Copos e Acessórios": "🥤",
    Combos: "🔥",
    Promoções: "🏷️",
  };

  return icones[categoria] ?? "🛒";
}

function formatarPreco(valor: number) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
type ProductSectionProps = {
  categoriaSelecionada?: string;
  busca?: string;
  mostrarTodos?: boolean;
};

export default async function ProductSection({
  categoriaSelecionada = "",
  busca = "",
  mostrarTodos = false,
}: ProductSectionProps) {
  let categoriaId: number | null = null;
  let categoriaNome = "";

  if (categoriaSelecionada) {
    const { data: categoriaEncontrada } = await supabase
      .from("categorias")
      .select("id, nome")
      .eq("slug", categoriaSelecionada)
      .eq("ativo", true)
      .maybeSingle();

    if (categoriaEncontrada) {
      categoriaId = Number(categoriaEncontrada.id);
      categoriaNome = categoriaEncontrada.nome;
    }
  }

  let consulta = supabase
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
      destaque,
      em_promocao,
      categoria_id,
      categoria:categorias (
        nome
      )
    `,
    )
    .eq("ativo", true)
    .order("destaque", { ascending: false })
    .order("nome", { ascending: true });

  if (categoriaSelecionada) {
    consulta = consulta.eq("categoria_id", categoriaId ?? -1);
  }
  if (busca) {
    consulta = consulta.ilike("nome", `%${busca}%`);
  }

  if (!categoriaSelecionada && !busca && !mostrarTodos) {
    consulta = consulta.eq("destaque", true);
  }

  const { data, error } = await consulta;

  if (error) {
    console.error("Erro ao buscar produtos:", error);

    return (
      <section id="produtos" className="scroll-mt-28 pb-16">
        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-6">
          <p className="font-bold text-red-400">
            Não foi possível carregar os produtos.
          </p>
        </div>
      </section>
    );
  }

  const produtos = (data ?? []) as unknown as Produto[];

  return (
    <section id="produtos" className="scroll-mt-28 pb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-amber-400">
            {busca
              ? "Resultados da busca"
              : categoriaSelecionada
                ? "Categoria selecionada"
                : "Mais pedidos"}
          </p>

          <h2 className="mt-1 text-3xl font-black">
            {busca
              ? `Resultados para "${busca}"`
              : categoriaSelecionada && categoriaNome
                ? categoriaNome
                : mostrarTodos
                  ? "Todos os produtos"
                  : "Os queridinhos do Zé"}
          </h2>
        </div>

        <Link
          href="/?todos=1#produtos"
          className="text-sm font-bold text-amber-400 transition hover:text-amber-300"
        >
          Ver todos →
        </Link>
      </div>

      {produtos.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400">Nenhum produto disponível no momento.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {produtos.map((produto) => {
            const categoria = Array.isArray(produto.categoria)
              ? (produto.categoria[0]?.nome ?? "Produto")
              : (produto.categoria?.nome ?? "Produto");
            const indisponivel = produto.estoque <= 0;

            const temPromocao =
              produto.em_promocao && produto.preco_promocional !== null;

            return (
              <article
                key={produto.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
              >
                <div className="relative flex h-52 items-center justify-center bg-zinc-800">
                  {produto.imagem_url ? (
                    <img
                      src={produto.imagem_url}
                      alt={produto.nome}
                      className="h-full w-full object-contain p-4"
                    />
                  ) : (
                    <span className="text-7xl">
                      {getIconeCategoria(categoria)}
                    </span>
                  )}

                  {temPromocao && (
                    <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black uppercase text-zinc-950">
                      Promoção
                    </span>
                  )}

                  {indisponivel && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70">
                      <span className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-bold">
                        Esgotado
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <span className="text-xs font-bold uppercase text-amber-400">
                    {categoria}
                  </span>

                  <h3 className="mt-2 text-xl font-black">{produto.nome}</h3>

                  <p className="mt-1 min-h-10 text-sm text-zinc-400">
                    {produto.descricao ??
                      "Produto disponível no Depósito do Zé"}
                  </p>

                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div>
                      {temPromocao ? (
                        <>
                          <p className="text-sm text-zinc-500 line-through">
                            {formatarPreco(produto.preco)}
                          </p>

                          <p className="text-xl font-black text-amber-400">
                            {formatarPreco(produto.preco_promocional!)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xl font-black">
                          {formatarPreco(produto.preco)}
                        </p>
                      )}

                      {produto.estoque > 0 && produto.estoque <= 5 && (
                        <p className="mt-1 text-xs font-bold text-orange-400">
                          Últimas {produto.estoque} unidades
                        </p>
                      )}
                    </div>

                    <AddToCartButton
                      indisponivel={indisponivel}
                      produto={{
                        id: produto.id,
                        nome: produto.nome,
                        preco: temPromocao
                          ? Number(produto.preco_promocional)
                          : Number(produto.preco),
                        imagem_url: produto.imagem_url,
                        estoque: produto.estoque,
                      }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

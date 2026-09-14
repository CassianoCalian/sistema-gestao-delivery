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
  permite_abaixo_minimo: boolean;

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

function calcularDesconto(preco: number, promocional: number) {
  if (preco <= 0 || promocional >= preco) {
    return 0;
  }

  return Math.round(((preco - promocional) / preco) * 100);
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
       permite_abaixo_minimo,
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
    if (process.env.NODE_ENV === "development") {
      console.error("Erro ao buscar produtos:", error);
    }

    return (
      <section id="produtos" className="scroll-mt-28 pb-10 sm:pb-20">
        <div className="premium-card rounded-3xl border border-red-500/15 bg-red-500/[0.04] p-7 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-xl">
            !
          </div>

          <p className="mt-4 font-black text-red-400">
            Não foi possível carregar os produtos.
          </p>

          <p className="mt-1 text-sm text-zinc-500">
            Tente atualizar a página em alguns instantes.
          </p>
        </div>
      </section>
    );
  }

  const produtos = (data ?? []) as unknown as Produto[];

  const tituloSuperior = busca
    ? "Resultados da busca"
    : categoriaSelecionada
      ? "Categoria selecionada"
      : mostrarTodos
        ? "Catálogo completo"
        : "Mais pedidos";

  const tituloPrincipal = busca
    ? `Resultados para "${busca}"`
    : categoriaSelecionada && categoriaNome
      ? categoriaNome
      : mostrarTodos
        ? "Todos os produtos"
        : "Os queridinhos do Zé";

  return (
    <section id="produtos" className="scroll-mt-28 pb-20">
      {/* CABEÇALHO */}
      <div className="mb-7 flex items-end justify-between gap-4">
        <div className="animate-slide-up min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-7 shrink-0 bg-amber-400" />

            <p className="truncate text-[11px] font-black uppercase tracking-[0.2em] text-amber-400 sm:text-xs">
              {tituloSuperior}
            </p>
          </div>

          <h2 className="text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
            {tituloPrincipal}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm text-zinc-500">
              {produtos.length}{" "}
              {produtos.length === 1
                ? "produto disponível"
                : "produtos disponíveis"}
            </p>

            {!busca &&
              !categoriaSelecionada &&
              !mostrarTodos &&
              produtos.length > 0 && (
                <span className="rounded-full border border-white/[0.06] bg-white/[0.035] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  Favoritos
                </span>
              )}
          </div>
        </div>

        {!mostrarTodos && (
          <Link
            href="/?todos=1#produtos"
            className="pressable hidden shrink-0 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-4 py-2.5 text-xs font-black text-zinc-300 transition hover:border-amber-400/30 hover:text-amber-300 sm:flex"
          >
            Ver todos
            <span>→</span>
          </Link>
        )}
      </div>

      {/* BOTÃO MOBILE */}
      {!mostrarTodos && (
        <div className="mb-5 sm:hidden">
          <Link
            href="/?todos=1#produtos"
            className="pressable flex w-full items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-xs font-black text-zinc-400"
          >
            Ver catálogo completo
            <span className="text-amber-400">→</span>
          </Link>
        </div>
      )}

      {produtos.length === 0 ? (
        <div className="premium-card rounded-[28px] p-8 text-center sm:p-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.06] bg-white/[0.035] text-3xl">
            🔎
          </div>

          <h3 className="mt-5 text-xl font-black text-white">Nada por aqui</h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
            Nenhum produto foi encontrado com os filtros selecionados.
          </p>

          <Link
            href="/#produtos"
            className="brand-button pressable mt-5 inline-flex rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider"
          >
            Ver produtos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {produtos.map((produto, index) => {
            const categoria = Array.isArray(produto.categoria)
              ? (produto.categoria[0]?.nome ?? "Produto")
              : (produto.categoria?.nome ?? "Produto");

            const indisponivel = produto.estoque <= 0;

            const temPromocao =
              produto.em_promocao && produto.preco_promocional !== null;

            const desconto = temPromocao
              ? calcularDesconto(
                  Number(produto.preco),
                  Number(produto.preco_promocional),
                )
              : 0;

            return (
              <article
                key={produto.id}
                className={`premium-card interactive-card group animate-slide-up relative flex min-w-0 flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] ${
                  produtos.length % 2 === 1 && index === produtos.length - 1
                    ? "col-span-2 mx-auto w-[calc(50%_-_0.375rem)] sm:col-span-1 sm:w-full"
                    : ""
                }`}
              >
                {/* IMAGEM */}
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-b from-white/[0.055] to-white/[0.015] sm:h-56">
                  {/* GLOW */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/[0.055] blur-3xl transition duration-500 group-hover:scale-150"
                  />

                  {/* TEXTURA */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.025]"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, white 1px, transparent 1px)",
                      backgroundSize: "14px 14px",
                    }}
                  />

                  {produto.imagem_url ? (
                    <img
                      src={produto.imagem_url}
                      alt={produto.nome}
                      loading="lazy"
                      className={`relative z-10 h-full w-full object-contain p-4 transition duration-500 sm:p-6 ${
                        indisponivel
                          ? "scale-95 opacity-35 grayscale"
                          : "group-hover:scale-[1.06]"
                      }`}
                    />
                  ) : (
                    <span
                      className={`relative z-10 text-6xl transition duration-500 sm:text-7xl ${
                        indisponivel
                          ? "opacity-30 grayscale"
                          : "group-hover:scale-110"
                      }`}
                    >
                      {getIconeCategoria(categoria)}
                    </span>
                  )}

                  {/* DESTAQUE */}
                  {produto.destaque && !temPromocao && !indisponivel && (
                    <span className="absolute left-2.5 top-2.5 z-20 rounded-full border border-white/[0.07] bg-zinc-950/75 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-amber-300 backdrop-blur-md sm:left-3 sm:top-3 sm:text-[9px]">
                      ⭐ Queridinho
                    </span>
                  )}

                  {/* PROMOÇÃO */}
                  {temPromocao && !indisponivel && (
                    <div className="absolute left-2.5 top-2.5 z-20 flex flex-col items-start gap-1.5 sm:left-3 sm:top-3">
                      <span className="rounded-full bg-amber-400 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-950 shadow-[0_8px_24px_rgba(245,158,11,0.25)] sm:text-[9px]">
                        🔥 Promoção
                      </span>

                      {desconto > 0 && (
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[8px] font-black text-emerald-400 backdrop-blur-md sm:text-[9px]">
                          -{desconto}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* ESGOTADO */}
                  {indisponivel && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/55 backdrop-blur-[2px]">
                      <span className="rounded-xl border border-white/10 bg-zinc-950/90 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300 shadow-xl sm:text-xs">
                        Esgotado
                      </span>
                    </div>
                  )}

                  {/* LINHA DE LUZ */}
                  <div className="absolute bottom-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                </div>

                {/* CONTEÚDO */}
                <div className="flex flex-1 flex-col p-3.5 sm:p-5">
                  {/* CATEGORIA */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">
                      {getIconeCategoria(categoria)}
                    </span>

                    <span className="truncate text-[9px] font-black uppercase tracking-[0.13em] text-amber-400/80 sm:text-[10px]">
                      {categoria}
                    </span>
                  </div>

                  {/* NOME */}
                  <h3 className="mt-2 line-clamp-2 min-h-[40px] text-[15px] font-black leading-5 tracking-[-0.02em] text-white sm:min-h-[48px] sm:text-lg sm:leading-6">
                    {produto.nome}
                  </h3>

                  {/* DESCRIÇÃO */}
                  <p className="mt-1.5 line-clamp-2 min-h-[32px] text-[11px] font-medium leading-4 text-zinc-500 sm:min-h-[40px] sm:text-xs sm:leading-5">
                    {produto.descricao ??
                      "Produto disponível no Depósito do Zé"}
                  </p>

                  {/* ESTOQUE BAIXO */}
                  {produto.estoque > 0 && produto.estoque <= 5 && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />

                      <p className="text-[9px] font-black text-orange-400 sm:text-[10px]">
                        Só {produto.estoque}{" "}
                        {produto.estoque === 1 ? "unidade" : "unidades"}
                      </p>
                    </div>
                  )}

                  {/* PREÇO + ADICIONAR */}
                  <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                    <div className="min-w-0">
                      {temPromocao ? (
                        <>
                          <p className="truncate text-[10px] font-medium text-zinc-600 line-through sm:text-xs">
                            {formatarPreco(produto.preco)}
                          </p>

                          <p className="truncate text-[17px] font-black tracking-[-0.04em] text-amber-400 sm:text-xl">
                            {formatarPreco(produto.preco_promocional!)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-600 sm:text-[10px]">
                            Por
                          </p>

                          <p className="truncate text-[17px] font-black tracking-[-0.04em] text-white sm:text-xl">
                            {formatarPreco(produto.preco)}
                          </p>
                        </>
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
                        permite_abaixo_minimo: produto.permite_abaixo_minimo,
                      }}
                    />
                  </div>
                </div>

                {/* GLOW INFERIOR */}
                {temPromocao && !indisponivel && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-16 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-amber-400/[0.06] blur-3xl"
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { supabase } from "../lib/supabase";

import PromoCarousel, { type ProdutoPromocional } from "./PromoCarousel";

export default async function HeroBanner() {
  const { data, error } = await supabase
    .from("produtos")
    .select(
      `
      id,
      nome,
      descricao,
      preco,
      preco_promocional,
      imagem_url,
      estoque
    `,
    )
    .eq("ativo", true)
    .eq("em_promocao", true)
    .gt("estoque", 0)
    .not("preco_promocional", "is", null)
    .order("destaque", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Erro ao buscar produtos promocionais:", error);
    }

    return null;
  }

  const produtos = (data ?? []) as ProdutoPromocional[];

  return <PromoCarousel produtos={produtos} />;
}

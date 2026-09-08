"use client";

import { useCart } from "../context/CartContext";

type AddToCartButtonProps = {
  produto: {
    id: number;
    nome: string;
    preco: number;
    imagem_url: string | null;
    estoque: number;
  };
  indisponivel?: boolean;
};

export default function AddToCartButton({
  produto,
  indisponivel = false,
}: AddToCartButtonProps) {
  const { adicionarProduto, itens } = useCart();

  const itemNoCarrinho = itens.find((item) => item.id === produto.id);

  const limiteAtingido = itemNoCarrinho
    ? itemNoCarrinho.quantidade >= produto.estoque
    : false;

  const botaoBloqueado = indisponivel || limiteAtingido;

  return (
    <button
      type="button"
      disabled={botaoBloqueado}
      onClick={() => adicionarProduto(produto)}
      aria-label={`Adicionar ${produto.nome} ao carrinho`}
      className="h-11 w-11 rounded-xl bg-amber-400 text-xl font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
    >
      +
    </button>
  );
}

"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type ProdutoCarrinho = {
  id: number;
  nome: string;
  preco: number;
  imagem_url?: string | null;
  estoque: number;
};

export type ItemCarrinho = ProdutoCarrinho & {
  quantidade: number;
};

type CartContextType = {
  itens: ItemCarrinho[];
  adicionarProduto: (produto: ProdutoCarrinho) => void;
  removerProduto: (id: number) => void;
  aumentarQuantidade: (id: number) => void;
  diminuirQuantidade: (id: number) => void;
  limparCarrinho: () => void;
  quantidadeTotal: number;
  valorTotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);

  function adicionarProduto(produto: ProdutoCarrinho) {
    setItens((itensAtuais) => {
      const produtoExistente = itensAtuais.find(
        (item) => item.id === produto.id,
      );

      if (produtoExistente) {
        if (produtoExistente.quantidade >= produto.estoque) {
          return itensAtuais;
        }

        return itensAtuais.map((item) =>
          item.id === produto.id
            ? {
                ...item,
                quantidade: item.quantidade + 1,
              }
            : item,
        );
      }

      if (produto.estoque <= 0) {
        return itensAtuais;
      }

      return [
        ...itensAtuais,
        {
          ...produto,
          quantidade: 1,
        },
      ];
    });
  }

  function removerProduto(id: number) {
    setItens((itensAtuais) => itensAtuais.filter((item) => item.id !== id));
  }

  function aumentarQuantidade(id: number) {
    setItens((itensAtuais) =>
      itensAtuais.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (item.quantidade >= item.estoque) {
          return item;
        }

        return {
          ...item,
          quantidade: item.quantidade + 1,
        };
      }),
    );
  }

  function diminuirQuantidade(id: number) {
    setItens((itensAtuais) =>
      itensAtuais
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantidade: item.quantidade - 1,
              }
            : item,
        )
        .filter((item) => item.quantidade > 0),
    );
  }

  function limparCarrinho() {
    setItens([]);
  }

  const quantidadeTotal = useMemo(() => {
    return itens.reduce((total, item) => total + item.quantidade, 0);
  }, [itens]);

  const valorTotal = useMemo(() => {
    return itens.reduce(
      (total, item) => total + item.preco * item.quantidade,
      0,
    );
  }, [itens]);

  return (
    <CartContext.Provider
      value={{
        itens,
        adicionarProduto,
        removerProduto,
        aumentarQuantidade,
        diminuirQuantidade,
        limparCarrinho,
        quantidadeTotal,
        valorTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart precisa ser usado dentro de CartProvider");
  }

  return context;
}

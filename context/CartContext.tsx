"use client";

import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type ProdutoCarrinho = {
  id: number;
  nome: string;
  preco: number;
  imagem_url?: string | null;
  estoque: number;
  permite_abaixo_minimo?: boolean;

  unidades_por_item?: number;

  opcoes?:
    | {
        id: number;
        nome: string;
        ativo: boolean;
        ordem: number;
      }[]
    | null;

  opcao_selecionada?: string | null;
};

export type ItemCarrinho = ProdutoCarrinho & {
  quantidade: number;
};

type CartContextType = {
  itens: ItemCarrinho[];
  adicionarProduto: (produto: ProdutoCarrinho) => void;
  removerProduto: (id: number, opcaoSelecionada?: string | null) => void;

  aumentarQuantidade: (id: number, opcaoSelecionada?: string | null) => void;

  diminuirQuantidade: (id: number, opcaoSelecionada?: string | null) => void;
  limparCarrinho: () => void;
  quantidadeTotal: number;
  valorTotal: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function normalizarOpcao(opcao?: string | null) {
  return typeof opcao === "string" ? opcao.trim().toLowerCase() : "";
}

function mesmoItemCarrinho(
  item: ProdutoCarrinho,
  id: number,
  opcaoSelecionada?: string | null,
) {
  return (
    item.id === id &&
    normalizarOpcao(item.opcao_selecionada) ===
      normalizarOpcao(opcaoSelecionada)
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);

  function adicionarProduto(produto: ProdutoCarrinho) {
    setItens((itensAtuais) => {
      const opcaoSelecionada = produto.opcao_selecionada?.trim() || null;

      const quantidadeTotalDoProduto = itensAtuais
        .filter((item) => item.id === produto.id)
        .reduce((total, item) => total + item.quantidade, 0);

      if (quantidadeTotalDoProduto >= produto.estoque) {
        return itensAtuais;
      }

      const produtoExistente = itensAtuais.find((item) =>
        mesmoItemCarrinho(item, produto.id, opcaoSelecionada),
      );

      if (produtoExistente) {
        return itensAtuais.map((item) =>
          mesmoItemCarrinho(item, produto.id, opcaoSelecionada)
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
          opcao_selecionada: opcaoSelecionada,
          quantidade: 1,
        },
      ];
    });
  }

  function removerProduto(id: number, opcaoSelecionada?: string | null) {
    setItens((itensAtuais) =>
      itensAtuais.filter(
        (item) => !mesmoItemCarrinho(item, id, opcaoSelecionada),
      ),
    );
  }

  function aumentarQuantidade(id: number, opcaoSelecionada?: string | null) {
    setItens((itensAtuais) => {
      const quantidadeTotalDoProduto = itensAtuais
        .filter((item) => item.id === id)
        .reduce((total, item) => total + item.quantidade, 0);

      return itensAtuais.map((item) => {
        if (!mesmoItemCarrinho(item, id, opcaoSelecionada)) {
          return item;
        }

        if (quantidadeTotalDoProduto >= item.estoque) {
          return item;
        }

        return {
          ...item,
          quantidade: item.quantidade + 1,
        };
      });
    });
  }

  function diminuirQuantidade(id: number, opcaoSelecionada?: string | null) {
    setItens((itensAtuais) =>
      itensAtuais
        .map((item) =>
          mesmoItemCarrinho(item, id, opcaoSelecionada)
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

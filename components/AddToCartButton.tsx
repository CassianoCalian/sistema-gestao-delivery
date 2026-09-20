"use client";

import { useState, type MouseEvent } from "react";

import { useCart } from "../context/CartContext";

type AddToCartButtonProps = {
  produto: {
    id: number;
    nome: string;
    preco: number;
    imagem_url: string | null;
    estoque: number;
    unidades_por_item: number;
    permite_abaixo_minimo: boolean;
    opcoes?:
      | {
          id: number;
          nome: string;
          ativo: boolean;
          ordem: number;
        }[]
      | null;
  };

  indisponivel?: boolean;
};

export default function AddToCartButton({
  produto,
  indisponivel = false,
}: AddToCartButtonProps) {
  const { adicionarProduto, itens } = useCart();

  const [adicionado, setAdicionado] = useState(false);

  const quantidadeNoCarrinho = itens
    .filter((item) => item.id === produto.id)
    .reduce((total, item) => total + item.quantidade, 0);

  const limiteAtingido = quantidadeNoCarrinho >= produto.estoque;

  const botaoBloqueado = indisponivel || limiteAtingido;

  function animarProdutoAteCarrinho(event: MouseEvent<HTMLButtonElement>) {
    const carrinho = document.getElementById("cart-button");

    if (!carrinho) {
      return;
    }

    const reduzirMovimento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduzirMovimento) {
      return;
    }

    const origem = event.currentTarget.getBoundingClientRect();
    const destino = carrinho.getBoundingClientRect();

    const inicioX = origem.left + origem.width / 2;
    const inicioY = origem.top + origem.height / 2;

    const destinoX = destino.left + destino.width / 2;
    const destinoY = destino.top + destino.height / 2;

    const deslocamentoX = destinoX - inicioX;
    const deslocamentoY = destinoY - inicioY;

    const elemento = document.createElement("div");

    elemento.style.position = "fixed";
    elemento.style.left = `${inicioX - 22}px`;
    elemento.style.top = `${inicioY - 22}px`;
    elemento.style.width = "44px";
    elemento.style.height = "44px";
    elemento.style.zIndex = "9999";
    elemento.style.pointerEvents = "none";
    elemento.style.borderRadius = "15px";
    elemento.style.overflow = "hidden";
    elemento.style.background =
      "linear-gradient(135deg, #fde68a, #fbbf24, #f59e0b)";
    elemento.style.border = "1px solid rgba(253, 230, 138, 0.45)";
    elemento.style.boxShadow = "0 8px 22px rgba(245, 158, 11, 0.28)";
    elemento.style.display = "flex";
    elemento.style.alignItems = "center";
    elemento.style.justifyContent = "center";
    elemento.style.willChange = "transform, opacity";
    elemento.style.contain = "layout paint style";

    const imagemDoCard = event.currentTarget
      .closest("article")
      ?.querySelector("img");

    if (imagemDoCard instanceof HTMLImageElement) {
      const imagem = document.createElement("img");

      imagem.src = imagemDoCard.currentSrc || imagemDoCard.src;
      imagem.alt = "";
      imagem.decoding = "async";
      imagem.style.width = "100%";
      imagem.style.height = "100%";
      imagem.style.objectFit = "contain";
      imagem.style.padding = "5px";

      elemento.appendChild(imagem);
    } else if (produto.imagem_url) {
      const imagem = document.createElement("img");

      imagem.src = produto.imagem_url;
      imagem.alt = "";
      imagem.decoding = "async";
      imagem.style.width = "100%";
      imagem.style.height = "100%";
      imagem.style.objectFit = "contain";
      imagem.style.padding = "5px";

      elemento.appendChild(imagem);
    } else {
      elemento.textContent = "🛒";
      elemento.style.fontSize = "21px";
    }

    document.body.appendChild(elemento);

    const alturaCurva = Math.min(
      105,
      Math.max(50, Math.abs(deslocamentoY) * 0.18),
    );

    const animacao = elemento.animate(
      [
        {
          transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)",
          opacity: 1,
        },
        {
          transform: `translate3d(
          ${deslocamentoX * 0.5}px,
          ${deslocamentoY * 0.35 - alturaCurva}px,
          0
        ) scale(0.78) rotate(-6deg)`,
          opacity: 0.98,
          offset: 0.5,
        },
        {
          transform: `translate3d(
          ${deslocamentoX}px,
          ${deslocamentoY}px,
          0
        ) scale(0.18) rotate(10deg)`,
          opacity: 0.08,
        },
      ],
      {
        duration: 520,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
      },
    );

    animacao.onfinish = () => {
      elemento.remove();

      carrinho.animate(
        [
          {
            transform: "scale(1)",
          },
          {
            transform: "scale(1.1) rotate(-2deg)",
          },
          {
            transform: "scale(0.97) rotate(1deg)",
          },
          {
            transform: "scale(1)",
          },
        ],
        {
          duration: 260,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    };
  }

  function adicionar(event: MouseEvent<HTMLButtonElement>) {
    if (botaoBloqueado) {
      return;
    }

    animarProdutoAteCarrinho(event);

    adicionarProduto({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem_url: produto.imagem_url,
      estoque: produto.estoque,
      permite_abaixo_minimo: produto.permite_abaixo_minimo,
      unidades_por_item: produto.unidades_por_item,
      opcoes: produto.opcoes ?? [],
      opcao_selecionada: null,
    });

    setAdicionado(true);

    window.setTimeout(() => {
      setAdicionado(false);
    }, 900);
  }

  return (
    <>
      <button
        type="button"
        disabled={botaoBloqueado}
        onClick={adicionar}
        aria-label={
          limiteAtingido
            ? `Limite de estoque atingido para ${produto.nome}`
            : `Adicionar ${produto.nome} ao carrinho`
        }
        className={`
        pressable group relative flex h-12 w-12 shrink-0
        items-center justify-center overflow-hidden
        rounded-2xl border font-black transition duration-300

        ${
          adicionado
            ? "border-emerald-300/30 bg-emerald-400 text-zinc-950 shadow-[0_10px_30px_rgba(52,211,153,0.22)]"
            : "border-amber-300/30 bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-zinc-950 shadow-[0_10px_30px_rgba(245,158,11,0.22)]"
        }

        disabled:cursor-not-allowed
        disabled:border-white/[0.06]
        disabled:bg-none
        disabled:bg-zinc-800
        disabled:text-zinc-600
        disabled:shadow-none
      `}
      >
        {!botaoBloqueado && !adicionado && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-8 top-0 h-full w-6 rotate-12 bg-white/35 blur-sm transition-transform duration-700 group-hover:translate-x-20"
          />
        )}

        {adicionado && (
          <span
            aria-hidden="true"
            className="absolute inset-0 animate-ping rounded-2xl border border-emerald-300/40 opacity-40"
          />
        )}

        <span
          className={`
          relative flex items-center justify-center
          text-xl transition-all duration-300

          ${
            adicionado
              ? "scale-110 rotate-0"
              : "scale-100 rotate-0 group-hover:rotate-90"
          }
        `}
        >
          {adicionado ? "✓" : "+"}
        </span>

        <span className="sr-only" aria-live="polite">
          {adicionado ? `${produto.nome} adicionado ao carrinho` : ""}
        </span>
      </button>
    </>
  );
}

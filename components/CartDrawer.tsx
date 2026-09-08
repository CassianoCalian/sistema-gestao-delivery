"use client";

import { useCart } from "../context/CartContext";
import { useRouter } from "next/navigation";

type CartDrawerProps = {
  aberto: boolean;
  fechar: () => void;
};

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CartDrawer({ aberto, fechar }: CartDrawerProps) {
  const {
    itens,
    aumentarQuantidade,
    diminuirQuantidade,
    removerProduto,
    limparCarrinho,
    quantidadeTotal,
    valorTotal,
  } = useCart();
  const router = useRouter();

  if (!aberto) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Fundo escuro */}
      <button
        type="button"
        aria-label="Fechar carrinho"
        onClick={fechar}
        className="absolute inset-0 bg-black/70"
      />

      {/* Painel */}
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-6">
          <div>
            <h2 className="text-2xl font-black text-white">Seu carrinho</h2>

            <p className="mt-1 text-sm text-zinc-400">
              {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
            </p>
          </div>

          <button
            type="button"
            onClick={fechar}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-xl text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Produtos */}
        <div className="flex-1 overflow-y-auto p-6">
          {itens.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="text-6xl">🛒</span>

              <h3 className="mt-5 text-xl font-black">
                Seu carrinho está vazio
              </h3>

              <p className="mt-2 text-sm text-zinc-400">
                Adicione algumas bebidas para começar seu pedido.
              </p>

              <button
                type="button"
                onClick={fechar}
                className="mt-6 rounded-xl bg-amber-400 px-6 py-3 font-bold text-zinc-950 transition hover:bg-amber-300"
              >
                Continuar comprando
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {itens.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex gap-4">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-zinc-800">
                      {item.imagem_url ? (
                        <img
                          src={item.imagem_url}
                          alt={item.nome}
                          className="h-full w-full object-contain p-2"
                        />
                      ) : (
                        <span className="text-3xl">🥤</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-white">{item.nome}</h3>

                      <p className="mt-1 font-black text-amber-400">
                        {formatarPreco(item.preco)}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center rounded-xl border border-zinc-700 bg-zinc-950">
                          <button
                            type="button"
                            onClick={() => diminuirQuantidade(item.id)}
                            className="h-9 w-9 text-lg font-black transition hover:text-amber-400"
                          >
                            −
                          </button>

                          <span className="min-w-8 text-center text-sm font-bold">
                            {item.quantidade}
                          </span>

                          <button
                            type="button"
                            onClick={() => aumentarQuantidade(item.id)}
                            disabled={item.quantidade >= item.estoque}
                            className="h-9 w-9 text-lg font-black transition hover:text-amber-400 disabled:cursor-not-allowed disabled:text-zinc-600"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removerProduto(item.id)}
                          className="text-xs font-bold text-red-400 transition hover:text-red-300"
                        >
                          Remover
                        </button>
                      </div>
                      {item.quantidade >= item.estoque && (
                        <p className="mt-2 text-xs font-bold text-orange-400">
                          Quantidade máxima disponível: {item.estoque}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-400">Subtotal</span>

                      <span className="font-bold">
                        {formatarPreco(item.preco * item.quantidade)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Rodapé */}
        {itens.length > 0 && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-zinc-400">Total do pedido</span>

              <span className="text-2xl font-black text-amber-400">
                {formatarPreco(valorTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                fechar();
                router.push("/checkout");
              }}
              className="w-full rounded-xl bg-amber-400 px-5 py-4 text-base font-black text-zinc-950 transition hover:bg-amber-300"
            >
              Finalizar pedido
            </button>

            <button
              type="button"
              onClick={limparCarrinho}
              className="mt-3 w-full py-2 text-sm font-bold text-zinc-500 transition hover:text-red-400"
            >
              Limpar carrinho
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useCart } from "../../context/CartContext";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function CheckoutPage() {
  const router = useRouter();

  const { itens, quantidadeTotal, valorTotal, limparCarrinho } = useCart();
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [pedidoConcluido, setPedidoConcluido] = useState(false);
  const [bairroSelecionado, setBairroSelecionado] = useState("");
  const chaveIdempotenciaRef = useRef<string | null>(null);
  const envioEmAndamentoRef = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (envioEmAndamentoRef.current) {
      return;
    }

    envioEmAndamentoRef.current = true;

    setErro("");

    if (bairroSelecionado === "outro") {
      setErro(
        "Para outros bairros, a entrega é realizada via Uber Flash. Consulte o valor da entrega pelo WhatsApp.",
      );
      envioEmAndamentoRef.current = false;
      return;
    }

    setEnviando(true);

    try {
      let chaveIdempotencia =
        chaveIdempotenciaRef.current ??
        window.sessionStorage.getItem("deposito-ze-chave-idempotencia");

      if (!chaveIdempotencia) {
        chaveIdempotencia = crypto.randomUUID();

        window.sessionStorage.setItem(
          "deposito-ze-chave-idempotencia",
          chaveIdempotencia,
        );
      }

      chaveIdempotenciaRef.current = chaveIdempotencia;
      const formData = new FormData(event.currentTarget);

      const trocoDigitado = formData.get("troco_para")?.toString();

      const pedido = {
        chave_idempotencia: chaveIdempotencia,

        nome: formData.get("nome")?.toString() ?? "",
        telefone: formData.get("telefone")?.toString() ?? "",

        cep: formData.get("cep")?.toString() ?? "",
        bairro: formData.get("bairro")?.toString() ?? "",
        rua: formData.get("rua")?.toString() ?? "",
        numero: formData.get("numero")?.toString() ?? "",
        complemento: formData.get("complemento")?.toString() ?? "",
        referencia: formData.get("referencia")?.toString() ?? "",

        forma_pagamento: formaPagamento,

        troco_para:
          formaPagamento === "dinheiro" && trocoDigitado
            ? Number(trocoDigitado)
            : null,

        itens: itens.map((item) => ({
          id: item.id,
          quantidade: item.quantidade,
        })),
      };

      const resposta = await fetch("/api/pedidos", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(pedido),
      });

      const textoResposta = await resposta.text();

      let resultado: {
        erro?: string;
        sucesso?: boolean;
        pedido_id?: number;
        codigo_acesso?: string;
      } = {};

      if (textoResposta) {
        try {
          resultado = JSON.parse(textoResposta);
        } catch {
          console.error("Resposta inválida da API:", textoResposta);

          throw new Error(
            `A API respondeu em um formato inválido. Código: ${resposta.status}`,
          );
        }
      }

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ??
            `Erro ao finalizar o pedido. Código: ${resposta.status}`,
        );
      }

      if (!resultado.codigo_acesso) {
        throw new Error("A API não retornou o código de acesso do pedido.");
      }

      const codigoAcesso = resultado.codigo_acesso;

      window.sessionStorage.removeItem("deposito-ze-chave-idempotencia");
      chaveIdempotenciaRef.current = null;

      setPedidoConcluido(true);
      limparCarrinho();

      window.location.replace(`/pedido/${codigoAcesso}`);
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Ocorreu um erro ao finalizar o pedido.");
      }
    } finally {
      setEnviando(false);
      envioEmAndamentoRef.current = false;
    }
  }

  if (itens.length === 0 && !pedidoConcluido) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="max-w-md text-center">
          <span className="text-7xl">🛒</span>

          <h1 className="mt-6 text-3xl font-black">Seu carrinho está vazio</h1>

          <p className="mt-3 text-zinc-400">
            Adicione alguns produtos antes de finalizar o pedido.
          </p>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-8 rounded-xl bg-amber-400 px-6 py-3 font-black text-zinc-950"
          >
            Voltar para a loja
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-8 text-sm font-bold text-amber-400"
        >
          ← Voltar para a loja
        </button>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* FORMULÁRIO */}
          <section>
            <p className="text-sm font-black uppercase tracking-widest text-amber-400">
              Finalizar pedido
            </p>

            <h1 className="mt-2 text-4xl font-black">Dados para entrega</h1>

            <form
              id="checkout-form"
              onSubmit={handleSubmit}
              className="mt-8 space-y-8"
            >
              {/* CLIENTE */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-black">1. Seus dados</h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Nome completo
                    </label>

                    <input
                      type="text"
                      name="nome"
                      required
                      placeholder="Seu nome"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      WhatsApp
                    </label>

                    <input
                      type="tel"
                      name="telefone"
                      required
                      placeholder="(21) 99999-9999"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* ENDEREÇO */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-black">2. Endereço de entrega</h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold">CEP</label>

                    <input
                      type="text"
                      name="cep"
                      required
                      placeholder="00000-000"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Bairro
                    </label>

                    <select
                      name="bairro"
                      required
                      value={bairroSelecionado}
                      onChange={(event) =>
                        setBairroSelecionado(event.target.value)
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    >
                      <option value="">Selecione seu bairro</option>

                      <option value="Jardim Pernambuco">
                        Jardim Pernambuco — Entrega grátis
                      </option>

                      <option value="Jardim Nova Era">
                        Jardim Nova Era — Entrega grátis
                      </option>

                      <option value="outro">
                        Outro bairro — Entrega via Uber Flash
                      </option>
                    </select>
                  </div>

                  {bairroSelecionado === "outro" && (
                    <div className="md:col-span-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
                      <p className="font-black text-amber-400">
                        🛵 Entrega via Uber Flash
                      </p>

                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                        Para outros bairros, a entrega é realizada somente via
                        Uber Flash. Entre em contato conosco para consultar o
                        valor da corrida antes de finalizar seu pedido.
                      </p>

                      <a
                        href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                          "Olá! Gostaria de consultar o valor da entrega via Uber Flash para fazer um pedido no Depósito do Zé.",
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block rounded-xl bg-green-500 px-5 py-3 font-black text-white transition hover:bg-green-400"
                      >
                        💬 Consultar entrega pelo WhatsApp
                      </a>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Rua / Avenida
                    </label>

                    <input
                      type="text"
                      name="rua"
                      required
                      placeholder="Nome da rua"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Número
                    </label>

                    <input
                      type="text"
                      name="numero"
                      required
                      placeholder="123"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold">
                      Complemento
                    </label>

                    <input
                      type="text"
                      name="complemento"
                      placeholder="Casa, apto, bloco..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-bold">
                      Ponto de referência
                    </label>

                    <input
                      type="text"
                      name="referencia"
                      placeholder="Próximo a..."
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* PAGAMENTO */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-black">3. Forma de pagamento</h2>

                <div className="mt-5 space-y-3">
                  <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-zinc-700 p-4">
                    <input
                      type="radio"
                      name="pagamento"
                      value="pix"
                      checked={formaPagamento === "pix"}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                    />

                    <div>
                      <p className="font-black">PIX</p>
                      <p className="text-sm text-zinc-400">Pagamento via PIX</p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-zinc-700 p-4">
                    <input
                      type="radio"
                      name="pagamento"
                      value="cartao_entrega"
                      checked={formaPagamento === "cartao_entrega"}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                    />

                    <div>
                      <p className="font-black">Cartão na entrega</p>
                      <p className="text-sm text-zinc-400">
                        Débito ou crédito na maquininha
                      </p>
                    </div>
                  </label>

                  <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-zinc-700 p-4">
                    <input
                      type="radio"
                      name="pagamento"
                      value="dinheiro"
                      checked={formaPagamento === "dinheiro"}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                    />

                    <div>
                      <p className="font-black">Dinheiro na entrega</p>
                      <p className="text-sm text-zinc-400">
                        Pagamento ao receber o pedido
                      </p>
                    </div>
                  </label>
                </div>

                {formaPagamento === "dinheiro" && (
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-bold">
                      Precisa de troco para quanto?
                    </label>

                    <input
                      type="number"
                      name="troco_para"
                      step="0.01"
                      placeholder="Ex.: 100,00"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
                    />
                  </div>
                )}
                {erro && (
                  <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm font-bold text-red-300">
                    {erro}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={enviando || bairroSelecionado === "outro"}
                className="w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
              >
                {bairroSelecionado === "outro"
                  ? "Consulte a entrega pelo WhatsApp"
                  : enviando
                    ? "Enviando pedido..."
                    : "Confirmar pedido"}
              </button>
            </form>
          </section>

          {/* RESUMO */}
          <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:sticky lg:top-8">
            <h2 className="text-xl font-black">Resumo do pedido</h2>

            <p className="mt-1 text-sm text-zinc-400">
              {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
            </p>

            <div className="mt-6 space-y-4">
              {itens.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 border-b border-zinc-800 pb-4"
                >
                  <div>
                    <p className="font-bold">
                      {item.quantidade}x {item.nome}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {formatarPreco(item.preco)} cada
                    </p>
                  </div>

                  <p className="font-bold">
                    {formatarPreco(item.preco * item.quantidade)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>{formatarPreco(valorTotal)}</span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Taxa de entrega</span>

                <span>
                  {bairroSelecionado === "Jardim Pernambuco" ||
                  bairroSelecionado === "Jardim Nova Era"
                    ? "Grátis"
                    : bairroSelecionado === "outro"
                      ? "Via Uber Flash"
                      : "Selecione o bairro"}
                </span>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-black">Total</span>

                  <span className="text-2xl font-black text-amber-400">
                    {formatarPreco(valorTotal)}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={enviando || bairroSelecionado === "outro"}
              className="mt-6 hidden w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50 lg:block"
            >
              {bairroSelecionado === "outro"
                ? "Consulte a entrega pelo WhatsApp"
                : enviando
                  ? "Enviando pedido..."
                  : "Confirmar pedido"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

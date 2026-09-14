"use client";

import Image from "next/image";

import { useRef, useState, type FormEvent } from "react";

import { useRouter } from "next/navigation";

import { useCart } from "../../context/CartContext";

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const inputClassName =
  "w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm font-medium text-white placeholder:text-zinc-600 transition duration-300 focus:border-amber-400/40 focus:bg-white/[0.035] focus:shadow-[0_0_0_4px_rgba(251,191,36,0.04)]";

const labelClassName =
  "mb-2 block text-[11px] font-black uppercase tracking-[0.08em] text-zinc-400";

const PEDIDO_MINIMO = 30;
const TAXA_CARTAO = 2;

export default function CheckoutPage() {
  const router = useRouter();

  const { itens, quantidadeTotal, valorTotal, limparCarrinho } = useCart();

  const [formaPagamento, setFormaPagamento] = useState("pix");

  const [enviando, setEnviando] = useState(false);

  const [erro, setErro] = useState("");
  const [telefone, setTelefone] = useState("");

  const [consultandoFidelidade, setConsultandoFidelidade] = useState(false);

  const [erroFidelidade, setErroFidelidade] = useState("");

  const [fidelidade, setFidelidade] = useState<{
    encontrado: boolean;
    pontos_saldo: number;
    progresso_centavos: number;
  } | null>(null);

  const [pontosFidelidade, setPontosFidelidade] = useState(0);
  const [codigoCupom, setCodigoCupom] = useState("");

  const [consultandoCupom, setConsultandoCupom] = useState(false);

  const [erroCupom, setErroCupom] = useState("");

  const [cupomAplicado, setCupomAplicado] = useState<{
    codigo: string;
    percentual: number;
    desconto_maximo: number;
    desconto_estimado: number;
    valido_ate: string;
  } | null>(null);

  const [pedidoConcluido, setPedidoConcluido] = useState(false);

  const [bairroSelecionado, setBairroSelecionado] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [consultandoCep, setConsultandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");

  const chaveIdempotenciaRef = useRef<string | null>(null);

  const envioEmAndamentoRef = useRef(false);
  const taxaCartao = formaPagamento === "cartao_entrega" ? TAXA_CARTAO : 0;

  const descontoFidelidade = (pontosFidelidade / 500) * 5;

  const descontoCupom = cupomAplicado
    ? Math.min(
        Math.round(
          (valorTotal * (cupomAplicado.percentual / 100) + Number.EPSILON) *
            100,
        ) / 100,
        cupomAplicado.desconto_maximo,
      )
    : 0;

  const totalPedido = Math.max(
    valorTotal + taxaCartao - descontoFidelidade - descontoCupom,
    0,
  );

  const blocosDisponiveis = fidelidade?.encontrado
    ? Math.floor(fidelidade.pontos_saldo / 500)
    : 0;

  const blocosPermitidosPeloPedido = Math.floor(valorTotal / 5);

  const blocosMaximosResgate = Math.min(
    blocosDisponiveis,
    blocosPermitidosPeloPedido,
  );

  const possuiExcecaoMinimo = itens.some(
    (item) => item.permite_abaixo_minimo === true,
  );

  const valorFaltanteMinimo = possuiExcecaoMinimo
    ? 0
    : Math.max(PEDIDO_MINIMO - valorTotal, 0);

  async function aplicarCupom() {
    const codigoNormalizado = codigoCupom.trim().toUpperCase();

    setErroCupom("");

    if (!codigoNormalizado) {
      setCupomAplicado(null);
      setErroCupom("Informe o código do cupom.");
      return;
    }

    if (pontosFidelidade > 0) {
      setCupomAplicado(null);
      setErroCupom("O cupom não pode ser usado junto com resgate de pontos.");
      return;
    }

    const telefoneLimpo = telefone.replace(/\D/g, "");

    if (telefoneLimpo.length < 10) {
      setCupomAplicado(null);
      setErroCupom("Informe seu WhatsApp antes de aplicar o cupom.");
      return;
    }

    setConsultandoCupom(true);
    setCupomAplicado(null);

    try {
      const resposta = await fetch("/api/cupons/validar", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          codigo_cupom: codigoNormalizado,
          telefone,
          subtotal: valorTotal,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Não foi possível validar o cupom.");
      }

      setCupomAplicado({
        codigo: dados.codigo,
        percentual: Number(dados.percentual),
        desconto_maximo: Number(dados.desconto_maximo),
        desconto_estimado: Number(dados.desconto_estimado),
        valido_ate: dados.valido_ate,
      });

      setCodigoCupom(dados.codigo);
      setErroCupom("");
    } catch (error) {
      setCupomAplicado(null);

      setErroCupom(
        error instanceof Error
          ? error.message
          : "Não foi possível validar o cupom.",
      );
    } finally {
      setConsultandoCupom(false);
    }
  }

  function removerCupom() {
    setCupomAplicado(null);
    setCodigoCupom("");
    setErroCupom("");
  }

  async function consultarFidelidade() {
    const telefoneLimpo = telefone.replace(/\D/g, "");

    if (telefoneLimpo.length < 10) {
      setFidelidade(null);
      setPontosFidelidade(0);
      setErroFidelidade("");
      return;
    }

    setConsultandoFidelidade(true);
    setErroFidelidade("");
    setPontosFidelidade(0);

    try {
      const resposta = await fetch("/api/fidelidade/saldo", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          telefone,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível consultar seus pontos.",
        );
      }

      setFidelidade({
        encontrado: Boolean(dados.encontrado),

        pontos_saldo: Number(dados.pontos_saldo ?? 0),

        progresso_centavos: Number(dados.progresso_centavos ?? 0),
      });
    } catch (error) {
      setFidelidade(null);

      setErroFidelidade(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar seus pontos.",
      );
    } finally {
      setConsultandoFidelidade(false);
    }
  }

  async function consultarCep() {
    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      setErroCep("Informe um CEP válido com 8 números.");
      return;
    }

    setConsultandoCep(true);
    setErroCep("");

    try {
      const resposta = await fetch(`/api/cep/${cepLimpo}`);

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Não foi possível consultar o CEP.");
      }

      setRua(dados.rua ?? "");
      setCidade(dados.cidade ?? "");
      setUf(dados.uf ?? "");

      const bairroRecebido = (dados.bairro ?? "").trim();

      const bairroNormalizado = bairroRecebido
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      if (bairroNormalizado === "jardim pernambuco") {
        setBairroSelecionado("Jardim Pernambuco");
      } else if (bairroNormalizado === "jardim nova era") {
        setBairroSelecionado("Jardim Nova Era");
      } else if (bairroRecebido) {
        setBairroSelecionado("outro");
      } else {
        setBairroSelecionado("");
      }
    } catch (error) {
      setRua("");
      setCidade("");
      setUf("");
      setBairroSelecionado("");

      setErroCep(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o CEP.",
      );
    } finally {
      setConsultandoCep(false);
    }
  }

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

        pontos_fidelidade: pontosFidelidade,
        codigo_cupom: cupomAplicado?.codigo ?? "",

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
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-5 text-white">
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-400/[0.07] blur-[110px]"
        />

        <div className="animate-scale-in relative z-10 max-w-md text-center">
          <div className="premium-card mx-auto flex h-28 w-28 items-center justify-center rounded-[36px] text-5xl">
            🛒
          </div>

          <h1 className="mt-7 text-3xl font-black tracking-[-0.04em] text-white">
            Seu carrinho está vazio
          </h1>

          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-zinc-500">
            Escolha suas bebidas favoritas antes de finalizar seu pedido.
          </p>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="brand-button pressable mt-7 rounded-2xl px-7 py-4 text-xs font-black uppercase tracking-[0.08em]"
          >
            Voltar para a loja
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
      {/* GLOWS */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -left-40 -top-40 h-96 w-96 rounded-full bg-amber-400/[0.055] blur-[130px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-52 -right-40 h-[500px] w-[500px] rounded-full bg-orange-600/[0.045] blur-[150px]"
      />

      {/* TOPO */}
      <header className="relative z-20 border-b border-white/[0.06] bg-zinc-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="pressable flex h-11 items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-3 text-[11px] font-black text-zinc-400 transition hover:text-white"
          >
            <span>←</span>
            <span className="hidden sm:inline">Voltar para a loja</span>
          </button>

          <div className="relative h-12 w-[96px] sm:h-14 sm:w-[112px]">
            <Image
              src="/logo-deposito-ze.png"
              alt="Depósito do Zé"
              fill
              priority
              sizes="112px"
              className="object-contain"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

            <span className="hidden text-[10px] font-black uppercase tracking-[0.1em] text-emerald-400 sm:block">
              Checkout seguro
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        {/* PROGRESSO */}
        <div className="animate-slide-up mb-8 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            {[
              ["✓", "Carrinho"],
              ["2", "Entrega"],
              ["3", "Pagamento"],
            ].map(([numero, titulo], index) => (
              <div key={titulo} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-black ${
                      index === 0
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                        : "border-amber-400/25 bg-amber-400/[0.08] text-amber-400"
                    }`}
                  >
                    {numero}
                  </div>

                  <span className="mt-2 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-500 sm:text-[10px]">
                    {titulo}
                  </span>
                </div>

                {index < 2 && (
                  <div className="mx-2 mb-5 h-px flex-1 bg-gradient-to-r from-amber-400/25 to-white/[0.06] sm:mx-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* TÍTULO */}
        <div className="animate-slide-up delay-1 mb-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-px w-7 bg-amber-400" />

            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              Finalizar pedido
            </p>
          </div>

          <h1 className="text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
            Falta pouco para
            <span className="brand-gradient-text"> chegar até você.</span>
          </h1>

          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
            Preencha seus dados para confirmarmos a entrega do pedido.
          </p>
        </div>

        <div className="grid gap-7 lg:grid-cols-[1fr_380px] lg:gap-8">
          {/* FORMULÁRIO */}
          <section>
            <form
              id="checkout-form"
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* CLIENTE */}
              <div className="premium-card animate-slide-up delay-2 rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-sm font-black text-amber-400">
                    1
                  </div>

                  <div>
                    <h2 className="text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
                      Seus dados
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Para identificar e acompanhar seu pedido.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="nome" className={labelClassName}>
                      Nome completo
                    </label>

                    <input
                      id="nome"
                      type="text"
                      name="nome"
                      required
                      autoComplete="name"
                      placeholder="Seu nome"
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label htmlFor="telefone" className={labelClassName}>
                      WhatsApp
                    </label>

                    <input
                      id="telefone"
                      type="tel"
                      name="telefone"
                      required
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="(21) 99999-9999"
                      value={telefone}
                      onChange={(event) => {
                        setTelefone(event.target.value);

                        setFidelidade(null);

                        setPontosFidelidade(0);

                        setErroFidelidade("");

                        setCupomAplicado(null);

                        setCodigoCupom("");

                        setErroCupom("");
                      }}
                      onBlur={consultarFidelidade}
                      className={inputClassName}
                    />

                    <p className="mt-2 text-[10px] text-zinc-600">
                      Usaremos esse número para atualizações do pedido.
                    </p>
                    {consultandoFidelidade && (
                      <p className="mt-2 text-[10px] font-bold text-amber-400">
                        Consultando seus benefícios...
                      </p>
                    )}

                    {erroFidelidade && (
                      <p className="mt-2 text-[10px] font-bold text-red-400">
                        {erroFidelidade}
                      </p>
                    )}

                    {fidelidade?.encontrado && (
                      <p className="mt-2 text-[10px] font-bold text-emerald-400">
                        ✓ Cliente identificado — {fidelidade.pontos_saldo}{" "}
                        pontos
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* FIDELIDADE */}
              {fidelidade?.encontrado && (
                <div className="animate-scale-in rounded-[28px] border border-amber-400/20 bg-amber-400/[0.055] p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-xl">
                      ⭐
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-400">
                        Programa de fidelidade
                      </p>

                      <h3 className="mt-1 text-lg font-black text-white">
                        Você tem {fidelidade.pontos_saldo} pontos
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        A cada 500 pontos você pode usar R$ 5,00 de desconto.
                      </p>
                    </div>
                  </div>

                  {blocosMaximosResgate > 0 ? (
                    <div className="mt-5">
                      <label
                        htmlFor="pontos_fidelidade"
                        className={labelClassName}
                      >
                        Usar pontos neste pedido
                      </label>

                      <select
                        id="pontos_fidelidade"
                        value={pontosFidelidade}
                        onChange={(event) => {
                          const pontos = Number(event.target.value);

                          if (pontos > 0 && cupomAplicado) {
                            removerCupom();

                            setErroCupom(
                              "O cupom foi removido porque o resgate de pontos foi selecionado.",
                            );
                          }

                          setPontosFidelidade(pontos);
                        }}
                        className={`${inputClassName} bg-zinc-950 text-white [color-scheme:dark]`}
                      >
                        <option value={0}>Não usar pontos</option>

                        {Array.from(
                          {
                            length: blocosMaximosResgate,
                          },
                          (_, index) => {
                            const pontos = (index + 1) * 500;

                            const desconto = (index + 1) * 5;

                            return (
                              <option key={pontos} value={pontos}>
                                {pontos} pontos — R$ {desconto.toFixed(2)}
                              </option>
                            );
                          },
                        )}
                      </select>

                      {pontosFidelidade > 0 && (
                        <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
                          <p className="text-xs font-black text-emerald-400">
                            ✓ {pontosFidelidade} pontos serão utilizados
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-500">
                            Desconto de {formatarPreco(descontoFidelidade)}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                      <p className="text-xs font-bold text-zinc-400">
                        Continue comprando para liberar seu próximo desconto.
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-600">
                        Faltam {Math.max(500 - fidelidade.pontos_saldo, 0)}{" "}
                        pontos para R$ 5,00 de desconto.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* CUPOM */}
              <div className="premium-card animate-slide-up delay-3 rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-xl">
                    🎟️
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-300">
                      Cupom de desconto
                    </p>

                    <h3 className="mt-1 text-lg font-black text-white">
                      Tem um cupom?
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      Digite o código recebido pelo Depósito do Zé.
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={codigoCupom}
                      disabled={consultandoCupom || pontosFidelidade > 0}
                      onChange={(event) => {
                        const codigo = event.target.value.toUpperCase();

                        setCodigoCupom(codigo);
                        setCupomAplicado(null);
                        setErroCupom("");
                      }}
                      placeholder="EX.: VOLTA-CASSIANO-A7F2"
                      className={`${inputClassName} font-mono uppercase disabled:cursor-not-allowed disabled:opacity-50`}
                    />

                    {cupomAplicado ? (
                      <button
                        type="button"
                        onClick={removerCupom}
                        className="pressable min-h-12 shrink-0 rounded-2xl border border-red-400/15 bg-red-400/[0.06] px-5 text-xs font-black text-red-300 transition hover:bg-red-400/[0.12]"
                      >
                        Remover
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={aplicarCupom}
                        disabled={
                          consultandoCupom ||
                          pontosFidelidade > 0 ||
                          !codigoCupom.trim()
                        }
                        className="pressable min-h-12 shrink-0 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/[0.08] px-5 text-xs font-black text-fuchsia-200 transition hover:bg-fuchsia-400/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {consultandoCupom ? "Validando..." : "Aplicar"}
                      </button>
                    )}
                  </div>

                  {pontosFidelidade > 0 && (
                    <p className="mt-3 text-[10px] font-bold text-amber-400">
                      Para usar um cupom, selecione “Não usar pontos” na
                      fidelidade.
                    </p>
                  )}

                  {erroCupom && (
                    <div className="mt-3 rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-3">
                      <p className="text-[10px] font-bold text-red-300">
                        {erroCupom}
                      </p>
                    </div>
                  )}

                  {cupomAplicado && (
                    <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black text-emerald-400">
                            ✓ Cupom aplicado
                          </p>

                          <p className="mt-1 font-mono text-sm font-black tracking-[0.04em] text-white">
                            {cupomAplicado.codigo}
                          </p>

                          <p className="mt-2 text-[10px] text-zinc-500">
                            {cupomAplicado.percentual}% de desconto · máximo{" "}
                            {formatarPreco(cupomAplicado.desconto_maximo)}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                            Economia
                          </p>

                          <p className="mt-1 text-lg font-black text-emerald-400">
                            - {formatarPreco(descontoCupom)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ENDEREÇO */}
              <div className="premium-card animate-slide-up delay-3 rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-sm font-black text-amber-400">
                    2
                  </div>

                  <div>
                    <h2 className="text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
                      Endereço de entrega
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Informe exatamente onde devemos entregar.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="cep" className={labelClassName}>
                      CEP
                    </label>

                    <input
                      id="cep"
                      type="text"
                      name="cep"
                      required
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      value={cep}
                      onChange={(event) => setCep(event.target.value)}
                      onBlur={consultarCep}
                      className={inputClassName}
                    />
                  </div>
                  {consultandoCep && (
                    <p className="mt-2 text-[10px] font-bold text-amber-400">
                      Consultando CEP...
                    </p>
                  )}

                  {erroCep && (
                    <p className="mt-2 text-[10px] font-bold text-red-400">
                      {erroCep}
                    </p>
                  )}

                  {!consultandoCep && !erroCep && cidade && uf && (
                    <p className="mt-2 text-[10px] font-bold text-emerald-400">
                      ✓ Endereço encontrado — {cidade}/{uf}
                    </p>
                  )}

                  <div className="md:col-span-2">
                    <label className={labelClassName}>Bairro</label>

                    <input
                      type="hidden"
                      name="bairro"
                      value={bairroSelecionado}
                    />

                    <div className="grid gap-2.5 sm:grid-cols-3">
                      {/* JARDIM PERNAMBUCO */}
                      <button
                        type="button"
                        disabled
                        className={`pressable relative flex min-h-[82px] items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-300 ${
                          bairroSelecionado === "Jardim Pernambuco"
                            ? "border-emerald-400/30 bg-emerald-400/[0.07] shadow-[0_10px_30px_rgba(34,197,94,0.06)]"
                            : "border-white/[0.07] bg-black/20"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            bairroSelecionado === "Jardim Pernambuco"
                              ? "bg-emerald-400/15"
                              : "bg-white/[0.04]"
                          }`}
                        >
                          🛵
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black text-white">
                            Jardim Pernambuco
                          </p>

                          <p className="mt-1 text-[10px] font-bold text-emerald-400">
                            Entrega grátis
                          </p>
                        </div>

                        {bairroSelecionado === "Jardim Pernambuco" && (
                          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-zinc-950">
                            ✓
                          </span>
                        )}
                      </button>

                      {/* JARDIM NOVA ERA */}
                      <button
                        type="button"
                        disabled
                        className={`pressable relative flex min-h-[82px] items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-300 ${
                          bairroSelecionado === "Jardim Nova Era"
                            ? "border-emerald-400/30 bg-emerald-400/[0.07] shadow-[0_10px_30px_rgba(34,197,94,0.06)]"
                            : "border-white/[0.07] bg-black/20"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            bairroSelecionado === "Jardim Nova Era"
                              ? "bg-emerald-400/15"
                              : "bg-white/[0.04]"
                          }`}
                        >
                          🛵
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black text-white">
                            Jardim Nova Era
                          </p>

                          <p className="mt-1 text-[10px] font-bold text-emerald-400">
                            Entrega grátis
                          </p>
                        </div>

                        {bairroSelecionado === "Jardim Nova Era" && (
                          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[10px] font-black text-zinc-950">
                            ✓
                          </span>
                        )}
                      </button>

                      {/* OUTRO BAIRRO */}
                      <button
                        type="button"
                        disabled
                        className={`pressable relative flex min-h-[82px] items-center gap-3 rounded-2xl border p-3.5 text-left transition duration-300 ${
                          bairroSelecionado === "outro"
                            ? "border-amber-400/30 bg-amber-400/[0.07] shadow-[0_10px_30px_rgba(245,158,11,0.06)]"
                            : "border-white/[0.07] bg-black/20"
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            bairroSelecionado === "outro"
                              ? "bg-amber-400/15"
                              : "bg-white/[0.04]"
                          }`}
                        >
                          📍
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black text-white">
                            Outro bairro
                          </p>

                          <p className="mt-1 text-[10px] font-bold text-amber-400">
                            Via Uber Flash
                          </p>
                        </div>

                        {bairroSelecionado === "outro" && (
                          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-zinc-950">
                            ✓
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* ENTREGA GRÁTIS */}
                  {(bairroSelecionado === "Jardim Pernambuco" ||
                    bairroSelecionado === "Jardim Nova Era") && (
                    <div className="animate-scale-in md:col-span-2">
                      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
                          🛵
                        </div>

                        <div>
                          <p className="text-xs font-black text-emerald-400">
                            Entrega grátis
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-500">
                            Seu bairro está dentro da nossa área de entrega.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UBER FLASH */}
                  {bairroSelecionado === "outro" && (
                    <div className="animate-scale-in md:col-span-2">
                      <div className="relative overflow-hidden rounded-[22px] border border-amber-400/20 bg-amber-400/[0.06] p-5">
                        <div
                          aria-hidden="true"
                          className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-400/10 blur-3xl"
                        />

                        <div className="relative">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-xl">
                              🛵
                            </div>

                            <div>
                              <p className="font-black text-amber-400">
                                Entrega via Uber Flash
                              </p>

                              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                                Consulte antes de finalizar
                              </p>
                            </div>
                          </div>

                          <p className="mt-4 text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
                            Para outros bairros, calculamos a entrega pelo Uber
                            Flash. Consulte o valor da corrida conosco antes de
                            finalizar.
                          </p>

                          <a
                            href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${encodeURIComponent(
                              "Olá! Gostaria de consultar o valor da entrega via Uber Flash para fazer um pedido no Depósito do Zé.",
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pressable mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-xs font-black text-white shadow-[0_10px_30px_rgba(34,197,94,0.16)] transition hover:bg-emerald-400 sm:w-auto"
                          >
                            💬 Consultar pelo WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label htmlFor="rua" className={labelClassName}>
                      Rua / Avenida
                    </label>

                    <input
                      id="rua"
                      type="text"
                      name="rua"
                      required
                      autoComplete="street-address"
                      placeholder="Nome da rua"
                      value={rua}
                      onChange={(event) => setRua(event.target.value)}
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label htmlFor="numero" className={labelClassName}>
                      Número
                    </label>

                    <input
                      id="numero"
                      type="text"
                      name="numero"
                      required
                      inputMode="numeric"
                      placeholder="123"
                      className={inputClassName}
                    />
                  </div>

                  <div>
                    <label htmlFor="complemento" className={labelClassName}>
                      Complemento
                      <span className="ml-1 font-medium normal-case tracking-normal text-zinc-700">
                        opcional
                      </span>
                    </label>

                    <input
                      id="complemento"
                      type="text"
                      name="complemento"
                      placeholder="Casa, apto, bloco..."
                      className={inputClassName}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="referencia" className={labelClassName}>
                      Ponto de referência
                      <span className="ml-1 font-medium normal-case tracking-normal text-zinc-700">
                        opcional
                      </span>
                    </label>

                    <input
                      id="referencia"
                      type="text"
                      name="referencia"
                      placeholder="Ex.: próximo ao mercado..."
                      className={inputClassName}
                    />
                  </div>
                </div>
              </div>

              {/* PAGAMENTO */}
              <div className="premium-card animate-slide-up delay-4 rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] text-sm font-black text-amber-400">
                    3
                  </div>

                  <div>
                    <h2 className="text-lg font-black tracking-[-0.02em] text-white sm:text-xl">
                      Forma de pagamento
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      Escolha como deseja pagar.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {/* PIX */}
                  <label
                    className={`pressable relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border p-4 transition duration-300 ${
                      formaPagamento === "pix"
                        ? "border-emerald-400/30 bg-emerald-400/[0.07] shadow-[0_10px_35px_rgba(34,197,94,0.06)]"
                        : "border-white/[0.07] bg-white/[0.025]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagamento"
                      value="pix"
                      checked={formaPagamento === "pix"}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="sr-only"
                    />

                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
                        formaPagamento === "pix"
                          ? "bg-emerald-400 text-zinc-950"
                          : "bg-white/[0.05]"
                      }`}
                    >
                      ◆
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-white">PIX</p>

                        <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-400">
                          Rápido
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-zinc-500">
                        Pagamento via PIX
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        formaPagamento === "pix"
                          ? "border-emerald-400 bg-emerald-400 text-[10px] font-black text-zinc-950"
                          : "border-zinc-700"
                      }`}
                    >
                      {formaPagamento === "pix" && "✓"}
                    </div>
                  </label>

                  {/* CARTÃO */}
                  <label
                    className={`pressable flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition duration-300 ${
                      formaPagamento === "cartao_entrega"
                        ? "border-amber-400/30 bg-amber-400/[0.06]"
                        : "border-white/[0.07] bg-white/[0.025]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagamento"
                      value="cartao_entrega"
                      checked={formaPagamento === "cartao_entrega"}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="sr-only"
                    />

                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
                        formaPagamento === "cartao_entrega"
                          ? "bg-amber-400 text-zinc-950"
                          : "bg-white/[0.05]"
                      }`}
                    >
                      💳
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white">Cartão na entrega</p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Débito ou crédito na maquininha
                      </p>
                      <p className="mt-1 text-[10px] font-black text-amber-400">
                        + R$ 2,00 de taxa
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        formaPagamento === "cartao_entrega"
                          ? "border-amber-400 bg-amber-400 text-[10px] font-black text-zinc-950"
                          : "border-zinc-700"
                      }`}
                    >
                      {formaPagamento === "cartao_entrega" && "✓"}
                    </div>
                  </label>

                  {/* DINHEIRO */}
                  <label
                    className={`pressable flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition duration-300 ${
                      formaPagamento === "dinheiro"
                        ? "border-amber-400/30 bg-amber-400/[0.06]"
                        : "border-white/[0.07] bg-white/[0.025]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pagamento"
                      value="dinheiro"
                      checked={formaPagamento === "dinheiro"}
                      onChange={(event) =>
                        setFormaPagamento(event.target.value)
                      }
                      className="sr-only"
                    />

                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg ${
                        formaPagamento === "dinheiro"
                          ? "bg-amber-400 text-zinc-950"
                          : "bg-white/[0.05]"
                      }`}
                    >
                      💵
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-black text-white">
                        Dinheiro na entrega
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        Pague quando receber o pedido
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        formaPagamento === "dinheiro"
                          ? "border-amber-400 bg-amber-400 text-[10px] font-black text-zinc-950"
                          : "border-zinc-700"
                      }`}
                    >
                      {formaPagamento === "dinheiro" && "✓"}
                    </div>
                  </label>
                </div>

                {formaPagamento === "dinheiro" && (
                  <div className="animate-scale-in mt-5 rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                    <label htmlFor="troco_para" className={labelClassName}>
                      Precisa de troco para quanto?
                    </label>

                    <input
                      id="troco_para"
                      type="number"
                      name="troco_para"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Ex.: 100,00"
                      className={inputClassName}
                    />

                    <p className="mt-2 text-[10px] text-zinc-600">
                      Se não precisar de troco, deixe em branco.
                    </p>
                  </div>
                )}
              </div>

              {/* ERRO */}
              {erro && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="animate-scale-in flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.07] p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    !
                  </div>

                  <div>
                    <p className="text-xs font-black text-red-400">
                      Não foi possível finalizar
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-300/80">
                      {erro}
                    </p>
                  </div>
                </div>
              )}
            </form>
          </section>

          {/* RESUMO */}
          <aside className="premium-card animate-slide-up delay-3 h-fit overflow-hidden rounded-[28px] lg:sticky lg:top-6">
            <div className="border-b border-white/[0.06] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-400">
                    Seu pedido
                  </p>

                  <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">
                    Resumo
                  </h2>
                </div>

                <span className="rounded-full border border-white/[0.06] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black text-zinc-400">
                  {quantidadeTotal} {quantidadeTotal === 1 ? "item" : "itens"}
                </span>
              </div>
            </div>

            {/* ITENS */}
            <div className="max-h-[340px] space-y-3 overflow-y-auto p-4 sm:p-5">
              {itens.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.035]">
                    {item.imagem_url ? (
                      <img
                        src={item.imagem_url}
                        alt={item.nome}
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : (
                      <span className="text-2xl">🥤</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-black leading-4 text-white">
                      {item.nome}
                    </p>

                    <p className="mt-1 text-[10px] text-zinc-600">
                      {item.quantidade}x {formatarPreco(item.preco)}
                    </p>
                  </div>

                  <p className="shrink-0 text-xs font-black text-zinc-300">
                    {formatarPreco(item.preco * item.quantidade)}
                  </p>
                </div>
              ))}
            </div>

            {/* VALORES */}
            <div className="border-t border-white/[0.06] p-5 sm:p-6">
              <div className="space-y-3 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Subtotal</span>

                  <span className="font-bold text-zinc-300">
                    {formatarPreco(valorTotal)}
                  </span>
                </div>
                {valorFaltanteMinimo > 0 && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.08em] text-amber-400">
                      Pedido mínimo: R$ 30,00
                    </p>

                    <p className="mt-1 text-xs text-zinc-400">
                      Faltam {formatarPreco(valorFaltanteMinimo)} em produtos
                      para atingir o valor mínimo da entrega.
                    </p>
                  </div>
                )}

                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Taxa de entrega</span>

                  <span
                    className={`text-right font-black ${
                      bairroSelecionado === "Jardim Pernambuco" ||
                      bairroSelecionado === "Jardim Nova Era"
                        ? "text-emerald-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {bairroSelecionado === "Jardim Pernambuco" ||
                    bairroSelecionado === "Jardim Nova Era"
                      ? "Grátis"
                      : bairroSelecionado === "outro"
                        ? "Via Uber Flash"
                        : "Selecione o bairro"}
                  </span>
                </div>
              </div>

              {taxaCartao > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Taxa do cartão</span>

                  <span className="font-black text-amber-400">
                    {formatarPreco(taxaCartao)}
                  </span>
                </div>
              )}

              {descontoFidelidade > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">Desconto fidelidade</span>

                  <span className="font-black text-emerald-400">
                    - {formatarPreco(descontoFidelidade)}
                  </span>
                </div>
              )}

              {descontoCupom > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">
                    Cupom {cupomAplicado?.codigo}
                  </span>

                  <span className="font-black text-emerald-400">
                    - {formatarPreco(descontoCupom)}
                  </span>
                </div>
              )}

              <div className="section-divider my-5" />

              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">
                    Total
                  </p>

                  <p className="mt-1 text-[10px] text-zinc-600">
                    Valor final do pedido
                  </p>
                </div>

                <span className="text-3xl font-black tracking-[-0.05em] text-amber-400">
                  {formatarPreco(totalPedido)}
                </span>
              </div>

              {/* CTA */}
              <button
                type="submit"
                form="checkout-form"
                disabled={enviando || bairroSelecionado === "outro"}
                className="brand-button pressable group mt-5 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.06em] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {bairroSelecionado === "outro" ? (
                  "Consulte a entrega"
                ) : enviando ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
                    Enviando...
                  </>
                ) : (
                  <>
                    Confirmar pedido
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center gap-4 text-[9px] font-bold text-zinc-600">
                <span>🔒 Seguro</span>
                <span>•</span>
                <span>⚡ Rápido</span>
                <span>•</span>
                <span>✓ Confirmado</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

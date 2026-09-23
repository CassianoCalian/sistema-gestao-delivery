"use client";

import { useMemo, useRef, useState } from "react";

type SpeechRecognitionEventLike = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;

  onresult: ((event: SpeechRecognitionEventLike) => void) | null;

  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type OpcaoProduto = {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
  permite_abaixo_minimo: boolean;
};

type ItemInterpretado = {
  id: number;
  nome: string;
  quantidade: number;
  preco: number;
  subtotal: number;
  estoque: number;
  permite_abaixo_minimo: boolean;
};

type ItemCarrinho = {
  id: number;
  nome: string;
  quantidade: number;
  preco: number;
  estoque: number;
  permite_abaixo_minimo: boolean;
};

type Duvida = {
  trecho: string;
  quantidade: number;
  opcoes: OpcaoProduto[];
};

type NaoEncontrado = {
  trecho: string;
  quantidade: number;
};

type ResultadoInterpretacao = {
  sucesso: boolean;

  mensagem_original: string;

  forma_pagamento: "pix" | "cartao" | "dinheiro" | null;

  partes_interpretadas: string[];

  itens: ItemInterpretado[];

  duvidas: Duvida[];

  nao_encontrados: NaoEncontrado[];

  subtotal: number;
};

type DadosCliente = {
  nome: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  referencia: string;
  forma_pagamento: string | null;
};

type RespostaCliente = {
  encontrado: boolean;
  possui_endereco?: boolean;
  verificado: boolean;
  precisa_confirmar?: boolean;
  confirmacao_incorreta?: boolean;
  dados?: DadosCliente;
  erro?: string;
};

type EtapaCliente = "telefone" | "confirmar" | "pronto";

function formatarPreco(valor: number) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function nomePagamento(pagamento: "pix" | "cartao" | "dinheiro" | null) {
  if (pagamento === "pix") {
    return "Pix";
  }

  if (pagamento === "cartao") {
    return "Cartão";
  }

  if (pagamento === "dinheiro") {
    return "Dinheiro";
  }

  return "Não informado";
}

function limparNomeDoPedido(trecho: string) {
  let texto = trecho.trim();

  texto = texto.replace(
    /^(quero|queria|manda|mande|me manda|vou querer)\s+/i,
    "",
  );

  texto = texto.replace(
    /^(um|uma|dois|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|\d+)\s+/i,
    "",
  );

  texto = texto.replace(/[.,!?]+$/g, "");

  return texto.trim();
}

export default function PedidoFacilPage() {
  const [pedido, setPedido] = useState("");

  const [ouvindo, setOuvindo] = useState(false);

  const [erro, setErro] = useState("");

  const [carregando, setCarregando] = useState(false);

  const [resultado, setResultado] = useState<ResultadoInterpretacao | null>(
    null,
  );

  const [escolhas, setEscolhas] = useState<Record<number, OpcaoProduto>>({});
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [etapa, setEtapa] = useState<"pedido" | "dados">("pedido");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [referencia, setReferencia] = useState("");

  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");

  const [formaPagamento, setFormaPagamento] = useState<
    "" | "pix" | "cartao" | "dinheiro"
  >("");

  const [consultandoCep, setConsultandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");

  const [etapaCliente, setEtapaCliente] = useState<EtapaCliente>("telefone");

  const [consultandoCliente, setConsultandoCliente] = useState(false);

  const [erroCliente, setErroCliente] = useState("");

  const [numeroConfirmacao, setNumeroConfirmacao] = useState("");

  const [clienteRecorrente, setClienteRecorrente] = useState(false);

  const [clienteComDados, setClienteComDados] = useState(false);

  const [formaPagamentoAnterior, setFormaPagamentoAnterior] = useState<
    "pix" | "cartao" | "dinheiro" | null
  >(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function normalizarPagamentoAnterior(valor: string | null) {
    if (valor === "pix") {
      return "pix" as const;
    }

    if (valor === "dinheiro") {
      return "dinheiro" as const;
    }

    if (valor === "cartao" || valor === "cartao_entrega") {
      return "cartao" as const;
    }

    return null;
  }

  async function consultarCliente() {
    setErroCliente("");

    const telefoneLimpo = telefone.replace(/\D/g, "");

    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      setErroCliente("Digite um WhatsApp válido com DDD.");

      return;
    }

    setConsultandoCliente(true);

    try {
      const resposta = await fetch("/api/pedido-facil/cliente", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          telefone,
        }),
      });

      const dados = (await resposta.json()) as RespostaCliente;

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível consultar seu cadastro.",
        );
      }

      if (!dados.encontrado) {
        setClienteRecorrente(false);
        setClienteComDados(false);
        setEtapaCliente("pronto");

        return;
      }

      setClienteRecorrente(true);

      if (dados.possui_endereco && dados.precisa_confirmar) {
        setEtapaCliente("confirmar");

        return;
      }

      setClienteComDados(false);
      setEtapaCliente("pronto");
    } catch (error) {
      setErroCliente(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar seu cadastro.",
      );
    } finally {
      setConsultandoCliente(false);
    }
  }

  async function confirmarCliente() {
    setErroCliente("");

    if (!numeroConfirmacao.trim()) {
      setErroCliente("Informe o número da residência do último pedido.");

      return;
    }

    setConsultandoCliente(true);

    try {
      const resposta = await fetch("/api/pedido-facil/cliente", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          telefone,
          numero_confirmacao: numeroConfirmacao,
        }),
      });

      const respostaCliente = (await resposta.json()) as RespostaCliente;

      if (!resposta.ok) {
        throw new Error(
          respostaCliente.erro ?? "Não foi possível confirmar seu cadastro.",
        );
      }

      if (respostaCliente.confirmacao_incorreta) {
        setErroCliente(
          "Esse número não corresponde ao seu último pedido. Confira e tente novamente.",
        );

        return;
      }

      if (!respostaCliente.verificado || !respostaCliente.dados) {
        throw new Error("Não foi possível confirmar os dados.");
      }

      const dados = respostaCliente.dados;

      setNome(dados.nome ?? "");
      setTelefone(dados.telefone ?? telefone);
      setCep(dados.cep ?? "");
      setRua(dados.rua ?? "");
      setNumero(dados.numero ?? "");
      setComplemento(dados.complemento ?? "");
      setBairro(dados.bairro ?? "");
      setReferencia(dados.referencia ?? "");

      setFormaPagamentoAnterior(
        normalizarPagamentoAnterior(dados.forma_pagamento),
      );

      setClienteRecorrente(true);
      setClienteComDados(true);
      setEtapaCliente("pronto");
      setNumeroConfirmacao("");
    } catch (error) {
      setErroCliente(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar seu cadastro.",
      );
    } finally {
      setConsultandoCliente(false);
    }
  }

  function alterarEnderecoSalvo() {
    setClienteComDados(false);

    setCep("");
    setRua("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setReferencia("");
    setCidade("");
    setUf("");
    setErroCep("");
  }

  function iniciarMicrofone() {
    setErro("");

    const navegador = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;

      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      navegador.SpeechRecognition || navegador.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErro(
        "Seu navegador não permite reconhecimento de voz. Você pode escrever o pedido normalmente.",
      );

      return;
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const textoFalado = event.results[0][0].transcript;

      setPedido((textoAtual) =>
        textoAtual ? `${textoAtual} ${textoFalado}` : textoFalado,
      );
    };

    recognition.onend = () => {
      setOuvindo(false);
    };

    recognition.onerror = () => {
      setOuvindo(false);

      setErro(
        "Não conseguimos ouvir direito. Tente novamente ou escreva o pedido.",
      );
    };

    recognitionRef.current = recognition;

    setOuvindo(true);

    recognition.start();
  }

  function pararMicrofone() {
    recognitionRef.current?.stop();

    setOuvindo(false);
  }

  async function continuarPedido() {
    setErro("");
    setResultado(null);
    setEscolhas({});
    setQuantidades({});

    if (!pedido.trim()) {
      setErro("Escreva ou fale o que você deseja pedir.");

      return;
    }

    setCarregando(true);

    try {
      const resposta = await fetch("/api/pedido-facil/interpretar", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          mensagem: pedido,
        }),
      });

      const dados = (await resposta.json()) as
        | ResultadoInterpretacao
        | {
            erro?: string;
          };

      if (!resposta.ok) {
        throw new Error(
          "erro" in dados ? dados.erro : "Não foi possível entender o pedido.",
        );
      }

      setResultado(dados as ResultadoInterpretacao);
      setPedido("");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível entender o pedido.",
      );
    } finally {
      setCarregando(false);
    }
  }

  function escolherProduto(indice: number, produto: OpcaoProduto) {
    setEscolhas((estadoAtual) => ({
      ...estadoAtual,

      [indice]: produto,
    }));
  }

  function alterarQuantidade(
    chave: string,
    quantidadeInicial: number,
    alteracao: number,
    estoque: number,
  ) {
    setQuantidades((estadoAtual) => {
      const quantidadeAtual = estadoAtual[chave] ?? quantidadeInicial;

      const novaQuantidade = Math.min(
        estoque,
        Math.max(1, quantidadeAtual + alteracao),
      );

      return {
        ...estadoAtual,
        [chave]: novaQuantidade,
      };
    });
  }

  function adicionarAoCarrinho() {
    if (!resultado || !podeContinuar || itensFinais.length === 0) {
      return;
    }

    setCarrinho((estadoAtual) => {
      const novoCarrinho = [...estadoAtual];

      itensFinais.forEach((item) => {
        const indiceExistente = novoCarrinho.findIndex(
          (produto) => produto.id === item.id,
        );

        if (indiceExistente >= 0) {
          const existente = novoCarrinho[indiceExistente];

          novoCarrinho[indiceExistente] = {
            ...existente,
            ...item,

            quantidade: Math.min(
              item.estoque,
              existente.quantidade + item.quantidade,
            ),
          };

          return;
        }

        novoCarrinho.push({
          ...item,

          quantidade: Math.min(item.estoque, item.quantidade),
        });
      });

      return novoCarrinho;
    });

    if (resultado.forma_pagamento) {
      setFormaPagamento(resultado.forma_pagamento);
    }

    setResultado(null);
    setEscolhas({});
    setQuantidades({});
    setPedido("");
    setErro("");

    setTimeout(() => {
      document.getElementById("campo-pedido")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  }

  function alterarQuantidadeCarrinho(id: number, alteracao: number) {
    setCarrinho((estadoAtual) =>
      estadoAtual.map((item) => {
        if (item.id !== id) {
          return item;
        }

        return {
          ...item,

          quantidade: Math.min(
            item.estoque,
            Math.max(1, item.quantidade + alteracao),
          ),
        };
      }),
    );
  }

  function removerDoCarrinho(id: number) {
    setCarrinho((estadoAtual) => estadoAtual.filter((item) => item.id !== id));
  }

  const subtotalCompleto = useMemo(() => {
    if (!resultado) {
      return 0;
    }

    let total = 0;

    resultado.itens.forEach((item, indice) => {
      const chave = `item-${indice}`;

      const quantidade = Math.min(
        item.estoque,
        Math.max(1, quantidades[chave] ?? item.quantidade),
      );

      total += item.preco * quantidade;
    });

    resultado.duvidas.forEach((duvida, indice) => {
      const escolha = escolhas[indice];

      if (!escolha) {
        return;
      }

      const chave = `duvida-${indice}`;

      const quantidade = Math.min(
        escolha.estoque,
        Math.max(1, quantidades[chave] ?? duvida.quantidade),
      );

      total += escolha.preco * quantidade;
    });

    return total;
  }, [resultado, escolhas, quantidades]);

  const todasDuvidasResolvidas = resultado
    ? resultado.duvidas.every((_, indice) => Boolean(escolhas[indice]))
    : false;

  const podeContinuar =
    Boolean(resultado) &&
    todasDuvidasResolvidas &&
    (resultado?.nao_encontrados.length ?? 0) === 0;

  const itensFinais: ItemCarrinho[] = (() => {
    if (!resultado) {
      return [];
    }

    const encontrados = resultado.itens.map((item, indice) => {
      const chave = `item-${indice}`;

      const quantidade = Math.min(
        item.estoque,
        Math.max(1, quantidades[chave] ?? item.quantidade),
      );

      return {
        id: item.id,
        nome: item.nome,
        quantidade,
        preco: item.preco,
        estoque: item.estoque,
        permite_abaixo_minimo: item.permite_abaixo_minimo,
      };
    });

    const escolhidos = resultado.duvidas
      .map((duvida, indice) => {
        const escolha = escolhas[indice];

        if (!escolha) {
          return null;
        }

        const chave = `duvida-${indice}`;

        const quantidade = Math.min(
          escolha.estoque,
          Math.max(1, quantidades[chave] ?? duvida.quantidade),
        );

        return {
          id: escolha.id,
          nome: escolha.nome,
          quantidade,
          preco: escolha.preco,
          estoque: escolha.estoque,
          permite_abaixo_minimo: escolha.permite_abaixo_minimo,
        };
      })
      .filter((item): item is ItemCarrinho => item !== null);

    return [...encontrados, ...escolhidos];
  })();

  const VALOR_MINIMO_PEDIDO = 30;

  const subtotalCarrinho = useMemo(() => {
    return carrinho.reduce(
      (total, item) => total + item.preco * item.quantidade,
      0,
    );
  }, [carrinho]);

  const temExcecaoPedidoMinimoCarrinho = carrinho.some(
    (item) => item.permite_abaixo_minimo,
  );

  const faltaParaPedidoMinimoCarrinho = Math.max(
    VALOR_MINIMO_PEDIDO - subtotalCarrinho,
    0,
  );

  const atingiuPedidoMinimoCarrinho =
    subtotalCarrinho >= VALOR_MINIMO_PEDIDO || temExcecaoPedidoMinimoCarrinho;

  const podeFinalizarCarrinho =
    carrinho.length > 0 && atingiuPedidoMinimoCarrinho;

  // Compatibilidade temporária com a interface antiga.
  // Amanhã este bloco será removido quando finalizarmos
  // a interface do carrinho conversacional.
  const temExcecaoPedidoMinimo = temExcecaoPedidoMinimoCarrinho;

  const faltaParaPedidoMinimo = faltaParaPedidoMinimoCarrinho;

  const podeAvancarParaDados = podeFinalizarCarrinho;

  function continuarParaDados() {
    if (!podeFinalizarCarrinho) {
      return;
    }

    setEtapa("dados");

    setTimeout(() => {
      document.getElementById("dados-entrega")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
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
        setBairro("Jardim Pernambuco");
      } else if (bairroNormalizado === "jardim nova era") {
        setBairro("Jardim Nova Era");
      } else {
        setBairro(bairroRecebido);

        setErroCep(
          "Este endereço está fora da área de entrega grátis. Para outros bairros, a entrega é feita via Uber Flash.",
        );
      }
    } catch (error) {
      setRua("");
      setCidade("");
      setUf("");
      setBairro("");

      setErroCep(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o CEP.",
      );
    } finally {
      setConsultandoCep(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8">
        <section className="flex flex-col gap-4">
          {/* ==========================================
      ETAPA 1 - TELEFONE
  ========================================== */}
          {etapaCliente === "telefone" && (
            <>
              <div className="flex items-end gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                  🍺
                </div>

                <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                  <p className="text-base font-black text-white">Olá! 👋</p>

                  <p className="mt-1 text-base leading-6 text-zinc-200">
                    Para deixar seu pedido mais rápido, qual é o seu WhatsApp?
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    Se você já pediu com a gente, conseguimos recuperar seus
                    dados.
                  </p>
                </div>
              </div>

              <div className="ml-12">
                <div className="flex gap-2 rounded-3xl border border-white/10 bg-zinc-900 p-2">
                  <input
                    type="tel"
                    value={telefone}
                    onChange={(event) => setTelefone(event.target.value)}
                    placeholder="(21) 99999-9999"
                    inputMode="tel"
                    autoComplete="tel"
                    className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-zinc-500"
                  />

                  <button
                    type="button"
                    onClick={consultarCliente}
                    disabled={consultandoCliente}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-black text-black transition hover:bg-amber-300 disabled:opacity-40"
                    aria-label="Continuar"
                  >
                    {consultandoCliente ? "…" : "➤"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ==========================================
      ETAPA 2 - CONFIRMAÇÃO
  ========================================== */}
          {etapaCliente === "confirmar" && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[82%] rounded-3xl rounded-br-md bg-amber-400 px-4 py-3 text-black">
                  <p className="font-bold">{telefone}</p>
                </div>
              </div>

              <div className="flex items-end gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                  🍺
                </div>

                <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-emerald-500/20 bg-zinc-900 px-4 py-4">
                  <p className="font-black text-emerald-300">
                    Encontrei seu cadastro! ✅
                  </p>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Para confirmar que é você, qual era o número da residência
                    do seu último pedido?
                  </p>
                </div>
              </div>

              <div className="ml-12">
                <div className="flex gap-2 rounded-3xl border border-white/10 bg-zinc-900 p-2">
                  <input
                    type="text"
                    value={numeroConfirmacao}
                    onChange={(event) =>
                      setNumeroConfirmacao(event.target.value)
                    }
                    placeholder="Número da residência"
                    inputMode="numeric"
                    className="h-12 min-w-0 flex-1 bg-transparent px-3 text-base font-medium text-white outline-none placeholder:text-zinc-500"
                  />

                  <button
                    type="button"
                    onClick={confirmarCliente}
                    disabled={consultandoCliente}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-black text-black disabled:opacity-40"
                  >
                    {consultandoCliente ? "…" : "➤"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTelefone("");
                    setNumeroConfirmacao("");
                    setErroCliente("");
                    setClienteRecorrente(false);
                    setClienteComDados(false);
                    setEtapaCliente("telefone");
                  }}
                  className="mt-3 text-sm font-semibold text-zinc-500 hover:text-white"
                >
                  ← Usar outro telefone
                </button>
              </div>
            </>
          )}

          {/* ERRO DO CLIENTE */}
          {erroCliente && (
            <div className="ml-12 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-medium text-red-300">
              {erroCliente}
            </div>
          )}

          {/* ==========================================
      CLIENTE LIBERADO PARA PEDIR
  ========================================== */}
          {etapaCliente === "pronto" && (
            <>
              {clienteRecorrente && clienteComDados && (
                <div className="flex items-end gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                    🍺
                  </div>

                  <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-4">
                    <p className="font-black text-emerald-300">
                      Pronto, {nome.split(" ")[0] || "cliente"}! ✅
                    </p>

                    <p className="mt-2 text-sm text-zinc-300">
                      Já encontrei seus dados de entrega:
                    </p>

                    <div className="mt-3 rounded-2xl bg-black/20 p-3 text-sm text-zinc-200">
                      <p className="font-bold">
                        {rua}, {numero}
                      </p>

                      <p className="mt-1 text-zinc-400">{bairro}</p>

                      {complemento && (
                        <p className="mt-1 text-zinc-400">{complemento}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={alterarEnderecoSalvo}
                      className="mt-3 text-sm font-bold text-amber-300 hover:text-amber-200"
                    >
                      Quero usar outro endereço
                    </button>
                  </div>
                </div>
              )}

              {clienteRecorrente && !clienteComDados && (
                <div className="flex items-end gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                    🍺
                  </div>

                  <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                    <p className="font-bold text-white">
                      Encontrei seu cadastro 👍
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      Depois do pedido confirmamos seu endereço de entrega.
                    </p>
                  </div>
                </div>
              )}

              {!clienteRecorrente && (
                <div className="flex items-end gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                    🍺
                  </div>

                  <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                    <p className="font-bold text-white">
                      Ainda não encontrei um cadastro com esse número.
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      Sem problema 😊 vamos cadastrar seus dados neste pedido.
                    </p>
                  </div>
                </div>
              )}

              {/* PERGUNTA DO PEDIDO */}
              <div className="flex items-end gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                  🍺
                </div>

                <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                  <p className="text-base font-black text-white">
                    O que você gostaria de pedir hoje?
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    Escreva ou toque no microfone e fale normalmente.
                  </p>
                </div>
              </div>

              {!resultado && (
                <div className="ml-12 max-w-[82%] rounded-2xl border border-amber-400/15 bg-amber-400/[0.06] px-4 py-3">
                  <p className="text-sm font-semibold text-amber-300">
                    Exemplo de pedido
                  </p>

                  <p className="mt-1 text-sm text-zinc-300">
                    “Quero 2 Heineken e uma Coca de 2 litros”
                  </p>
                </div>
              )}

              {/* MENSAGEM DO CLIENTE */}
              {resultado && (
                <div className="flex justify-end">
                  <div className="max-w-[82%] rounded-3xl rounded-br-md bg-amber-400 px-4 py-3 text-black">
                    <p className="text-base font-bold">
                      {resultado.mensagem_original}
                    </p>
                  </div>
                </div>
              )}

              {erro && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-medium text-red-300">
                  {erro}
                </div>
              )}

              {/* CAMPO DO PEDIDO */}
              <div className="mt-2 border-t border-white/10 pt-4">
                <div className="flex items-end gap-2 rounded-3xl border border-white/10 bg-zinc-900 p-2">
                  <button
                    type="button"
                    onClick={ouvindo ? pararMicrofone : iniciarMicrofone}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl transition ${
                      ouvindo
                        ? "animate-pulse bg-red-500 text-white"
                        : "bg-zinc-800 text-amber-400 hover:bg-zinc-700"
                    }`}
                  >
                    🎤
                  </button>

                  <textarea
                    value={pedido}
                    onChange={(event) => setPedido(event.target.value)}
                    placeholder="Digite seu pedido..."
                    rows={1}
                    className="max-h-32 min-h-12 flex-1 resize-none bg-transparent px-2 py-3 text-base font-medium text-white outline-none placeholder:text-zinc-500"
                  />

                  <button
                    type="button"
                    disabled={carregando || !pedido.trim()}
                    onClick={continuarPedido}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl font-black text-black disabled:opacity-30"
                  >
                    {carregando ? "…" : "➤"}
                  </button>
                </div>

                <p className="mt-2 text-center text-xs text-zinc-500">
                  {ouvindo
                    ? "🎤 Estou ouvindo..."
                    : "Fale ou escreva como se estivesse conversando com a gente."}
                </p>
              </div>
            </>
          )}
        </section>

        {resultado && (
          <section className="mt-5 space-y-4">
            {/* RESPOSTA DO ATENDENTE */}

            <div className="flex items-end gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                🍺
              </div>

              <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                <p className="text-base font-black text-white">
                  Entendi seu pedido 👍
                </p>

                {resultado.itens.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {resultado.itens.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-black/30 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">
                              {item.quantidade}x {item.nome}
                            </p>

                            <p className="mt-1 text-xs text-zinc-400">
                              {formatarPreco(item.preco)} cada
                            </p>
                          </div>

                          <strong className="whitespace-nowrap text-sm text-amber-400">
                            {formatarPreco(item.subtotal)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {resultado.forma_pagamento && (
                  <p className="mt-3 text-sm text-zinc-400">
                    Pagamento informado:{" "}
                    <strong className="text-white">
                      {nomePagamento(resultado.forma_pagamento)}
                    </strong>
                  </p>
                )}
              </div>
            </div>

            {/* DÚVIDAS / OPÇÕES */}
            {resultado.duvidas.map((duvida, indice) => (
              <div
                key={`${duvida.trecho}-${indice}`}
                className="flex items-end gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                  🍺
                </div>

                <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-amber-400/20 bg-zinc-900 px-4 py-4">
                  <p className="text-base font-bold text-white">
                    Encontrei algumas opções.
                  </p>

                  <p className="mt-1 text-sm leading-5 text-zinc-300">
                    Qual você prefere para{" "}
                    <strong>
                      {duvida.quantidade}x {limparNomeDoPedido(duvida.trecho)}
                    </strong>
                    ?
                  </p>

                  <div className="mt-4 space-y-2">
                    {duvida.opcoes.map((opcao) => {
                      const selecionado = escolhas[indice]?.id === opcao.id;

                      return (
                        <button
                          key={opcao.id}
                          type="button"
                          onClick={() => escolherProduto(indice, opcao)}
                          className={`w-full rounded-2xl border p-3 text-left transition ${
                            selecionado
                              ? "border-amber-400 bg-amber-400/10"
                              : "border-white/10 bg-black/30 hover:border-amber-400/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-white">
                                {opcao.nome}
                              </p>

                              <p className="mt-1 text-xs text-zinc-500">
                                Em estoque: {opcao.estoque}
                              </p>
                            </div>

                            <strong className="whitespace-nowrap text-sm text-amber-400">
                              {formatarPreco(opcao.preco)}
                            </strong>
                          </div>
                        </button>
                      );
                    })}
                    {escolhas[indice] &&
                      (() => {
                        const escolha = escolhas[indice];

                        const chave = `duvida-${indice}`;

                        const quantidade = Math.min(
                          escolha.estoque,
                          Math.max(1, quantidades[chave] ?? duvida.quantidade),
                        );

                        return (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                            <p className="mb-3 text-sm font-bold text-zinc-300">
                              Quantidade
                            </p>

                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  alterarQuantidade(
                                    chave,
                                    duvida.quantidade,
                                    -1,
                                    escolha.estoque,
                                  )
                                }
                                disabled={quantidade <= 1}
                                className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-xl font-black text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="Diminuir quantidade"
                              >
                                −
                              </button>

                              <div className="text-center">
                                <strong className="text-2xl font-black text-white">
                                  {quantidade}
                                </strong>

                                <p className="mt-1 text-xs text-zinc-500">
                                  {formatarPreco(escolha.preco * quantidade)}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  alterarQuantidade(
                                    chave,
                                    duvida.quantidade,
                                    1,
                                    escolha.estoque,
                                  )
                                }
                                disabled={quantidade >= escolha.estoque}
                                className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400 text-xl font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
                                aria-label="Aumentar quantidade"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                </div>
              </div>
            ))}

            {/* NÃO ENCONTRADOS */}
            {resultado.nao_encontrados.length > 0 && (
              <div className="flex items-end gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                  🍺
                </div>

                <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-red-500/20 bg-red-500/[0.08] px-4 py-4">
                  <p className="font-bold text-red-300">
                    Não consegui encontrar:
                  </p>

                  {resultado.nao_encontrados.map((item, indice) => (
                    <p key={indice} className="mt-2 text-sm text-zinc-200">
                      • {item.trecho}
                    </p>
                  ))}

                  <p className="mt-3 text-sm text-zinc-400">
                    Tente escrever o nome do produto de outra forma.
                  </p>
                </div>
              </div>
            )}

            {/* RESUMO DO ATENDENTE */}
            <div className="flex items-end gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                🍺
              </div>

              <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-sm font-bold text-zinc-300">
                    Subtotal
                  </span>

                  <strong className="text-xl font-black text-amber-400">
                    {formatarPreco(subtotalCompleto)}
                  </strong>
                </div>

                {!todasDuvidasResolvidas && (
                  <p className="mt-3 text-sm text-zinc-400">
                    Escolha uma das opções acima para continuar.
                  </p>
                )}

                {podeContinuar &&
                  !temExcecaoPedidoMinimo &&
                  subtotalCompleto < VALOR_MINIMO_PEDIDO && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] p-3">
                      <p className="text-sm font-bold text-amber-300">
                        Pedido mínimo: R$ 30,00
                      </p>

                      <p className="mt-1 text-sm text-zinc-300">
                        Faltam{" "}
                        <strong className="text-white">
                          {formatarPreco(faltaParaPedidoMinimo)}
                        </strong>{" "}
                        para continuar.
                      </p>
                    </div>
                  )}

                {podeContinuar &&
                  !temExcecaoPedidoMinimo &&
                  subtotalCompleto >= VALOR_MINIMO_PEDIDO && (
                    <p className="mt-4 text-sm font-bold text-emerald-400">
                      ✓ Pedido mínimo atingido
                    </p>
                  )}

                {podeContinuar && temExcecaoPedidoMinimo && (
                  <p className="mt-4 text-sm font-bold text-emerald-400">
                    ✓ Este item permite pedido abaixo de R$ 30,00
                  </p>
                )}

                <button
                  type="button"
                  disabled={!podeAvancarParaDados}
                  onClick={continuarParaDados}
                  className="mt-4 h-12 w-full rounded-2xl bg-amber-400 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Continuar pedido →
                </button>
              </div>
            </div>
          </section>
        )}

        {etapa === "dados" && (
          <section id="dados-entrega" className="mt-6 space-y-5">
            {clienteComDados && (
              <div className="flex items-end gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                  🍺
                </div>

                <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-4">
                  <p className="font-black text-emerald-300">
                    Seus dados já estão preenchidos ✅
                  </p>

                  <div className="mt-3 text-sm text-zinc-200">
                    <p className="font-bold">{nome}</p>

                    <p className="mt-2">
                      {rua}, {numero}
                    </p>

                    <p className="text-zinc-400">{bairro}</p>

                    {complemento && (
                      <p className="text-zinc-400">{complemento}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={alterarEnderecoSalvo}
                    className="mt-4 text-sm font-bold text-amber-300"
                  >
                    Alterar endereço
                  </button>
                </div>
              </div>
            )}
            {!clienteComDados && (
              <>
                {/* INÍCIO DOS DADOS */}
                <div className="flex items-end gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                    🍺
                  </div>

                  <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                    <p className="text-base font-black text-white">Ótimo! 👍</p>

                    <p className="mt-1 text-base leading-6 text-zinc-300">
                      Agora preciso de alguns dados para entregar seu pedido.
                    </p>
                  </div>
                </div>

                {/* NOME */}
                <div className="flex items-end gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                    🍺
                  </div>

                  <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                    <p className="mb-3 text-base font-bold text-white">
                      Qual é o seu nome?
                    </p>

                    <input
                      type="text"
                      value={nome}
                      onChange={(event) => setNome(event.target.value)}
                      placeholder="Digite seu nome"
                      autoComplete="name"
                      className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/50"
                    />
                  </div>
                </div>

                {/* TELEFONE */}

                {/* CEP */}
                <div className="flex items-end gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                    🍺
                  </div>

                  <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                    <p className="mb-3 text-base font-bold text-white">
                      Qual é o CEP da entrega?
                    </p>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cep}
                        onChange={(event) => setCep(event.target.value)}
                        placeholder="00000-000"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/50"
                      />

                      <button
                        type="button"
                        onClick={consultarCep}
                        disabled={consultandoCep}
                        className="rounded-2xl bg-amber-400 px-4 text-sm font-black text-black transition hover:bg-amber-300 disabled:opacity-40"
                      >
                        {consultandoCep ? "..." : "Buscar"}
                      </button>
                    </div>

                    {erroCep && (
                      <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] p-3 text-sm text-amber-200">
                        {erroCep}
                      </div>
                    )}
                  </div>
                </div>

                {/* ENDEREÇO ENCONTRADO */}
                {(rua || bairro || cidade) && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                      🍺
                    </div>

                    <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-4">
                      <p className="font-bold text-emerald-300">
                        Encontrei este endereço:
                      </p>

                      <div className="mt-3 space-y-1 text-sm text-zinc-200">
                        {rua && <p>{rua}</p>}

                        {bairro && <p>{bairro}</p>}

                        {(cidade || uf) && (
                          <p>
                            {cidade}
                            {cidade && uf ? " / " : ""}
                            {uf}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* NÚMERO */}
                {rua && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                      🍺
                    </div>

                    <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                      <p className="mb-3 text-base font-bold text-white">
                        Agora informe o número e, se tiver, o complemento.
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={numero}
                          onChange={(event) => setNumero(event.target.value)}
                          placeholder="Número"
                          inputMode="numeric"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/50"
                        />

                        <input
                          type="text"
                          value={complemento}
                          onChange={(event) =>
                            setComplemento(event.target.value)
                          }
                          placeholder="Complemento"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/50"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* REFERÊNCIA */}
                {rua && (
                  <div className="flex items-end gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                      🍺
                    </div>

                    <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                      <p className="mb-1 text-base font-bold text-white">
                        Tem algum ponto de referência?
                      </p>

                      <p className="mb-3 text-sm text-zinc-400">Opcional.</p>

                      <input
                        type="text"
                        value={referencia}
                        onChange={(event) => setReferencia(event.target.value)}
                        placeholder="Ex: perto da padaria"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-base text-white outline-none placeholder:text-zinc-500 focus:border-amber-400/50"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* PAGAMENTO */}
            <div className="flex items-end gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                🍺
              </div>

              <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                <p className="mb-3 text-base font-bold text-white">
                  Como você vai pagar?
                </p>

                {clienteComDados && formaPagamentoAnterior && (
                  <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-sm text-zinc-400">
                      Na última vez você pagou com{" "}
                      <strong className="text-amber-300">
                        {nomePagamento(formaPagamentoAnterior)}
                      </strong>
                      .
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Você pode escolher outra forma hoje.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["pix", "Pix"],
                    ["dinheiro", "Dinheiro"],
                    ["cartao", "Cartão"],
                  ].map(([valor, titulo]) => {
                    const selecionado = formaPagamento === valor;

                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() =>
                          setFormaPagamento(
                            valor as "pix" | "dinheiro" | "cartao",
                          )
                        }
                        className={`h-12 rounded-2xl border text-sm font-black transition ${
                          selecionado
                            ? "border-amber-400 bg-amber-400/10 text-amber-400"
                            : "border-white/10 bg-black/30 text-zinc-300 hover:border-white/20"
                        }`}
                      >
                        {titulo}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RESUMO FINAL */}
            <div className="flex items-end gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                🍺
              </div>

              <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                <p className="text-base font-black text-white">
                  Confere seu pedido 👇
                </p>

                <div className="mt-4 space-y-3">
                  {itensFinais.map((item) => (
                    <div
                      key={`${item.id}-${item.nome}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-zinc-200">
                          {item.quantidade}x {item.nome}
                        </p>

                        <p className="text-xs text-zinc-500">
                          {formatarPreco(item.preco)} cada
                        </p>
                      </div>

                      <strong className="text-sm text-amber-400">
                        {formatarPreco(item.preco * item.quantidade)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="font-black text-white">Subtotal</span>

                  <strong className="text-xl font-black text-amber-400">
                    {formatarPreco(subtotalCompleto)}
                  </strong>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-4 h-12 w-full cursor-not-allowed rounded-2xl bg-emerald-500 text-sm font-black text-black opacity-40"
                >
                  Confirmar pedido
                </button>

                <p className="mt-2 text-center text-xs text-zinc-600">
                  A confirmação final ainda está em teste.
                </p>
              </div>
            </div>
          </section>
        )}

        <p className="mt-auto pt-10 text-center text-xs text-zinc-600">
          Depósito do Zé • Pedido rápido e fácil
        </p>
      </div>
    </main>
  );
}

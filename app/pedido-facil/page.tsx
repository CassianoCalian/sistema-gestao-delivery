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

type OpcaoConfiguracao = {
  id: number;
  nome: string;
  ativo: boolean;
  ordem: number;
};

type OpcaoProduto = {
  id: number;
  nome: string;
  preco: number;
  estoque: number;
  permite_abaixo_minimo: boolean;
  unidades_por_item: number;
  opcoes: OpcaoConfiguracao[];
};

type ItemInterpretado = {
  id: number;
  nome: string;
  quantidade: number;
  preco: number;
  subtotal: number;
  estoque: number;
  permite_abaixo_minimo: boolean;
  unidades_por_item: number;
  opcoes: OpcaoConfiguracao[];
};

type OpcaoSelecionada = {
  opcao_id: number;
  nome: string;
  quantidade: number;
};

type ItemCarrinho = {
  id: number;
  nome: string;
  quantidade: number;
  preco: number;
  estoque: number;
  permite_abaixo_minimo: boolean;
  unidades_por_item: number;
  opcoes: OpcaoConfiguracao[];
  opcoes_selecionadas: OpcaoSelecionada[];
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
  const [opcoesSelecionadasPedido, setOpcoesSelecionadasPedido] = useState<
    Record<number, Record<number, number>>
  >({});

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

  const [trocoPara, setTrocoPara] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [erroFinalizacao, setErroFinalizacao] = useState("");

  const chaveIdempotenciaRef = useRef<string | null>(null);

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
    setOpcoesSelecionadasPedido({});

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

  function alterarOpcaoPedido(
    item: ItemCarrinho,
    opcaoId: number,
    alteracao: 1 | -1,
  ) {
    const totalNecessario = item.quantidade * item.unidades_por_item;

    setOpcoesSelecionadasPedido((estadoAtual) => {
      const selecoesProduto = estadoAtual[item.id] ?? {};

      const totalSelecionado = Object.values(selecoesProduto).reduce(
        (total, quantidade) => total + quantidade,
        0,
      );

      const quantidadeAtual = selecoesProduto[opcaoId] ?? 0;

      if (alteracao === 1 && totalSelecionado >= totalNecessario) {
        return estadoAtual;
      }

      if (alteracao === -1 && quantidadeAtual <= 0) {
        return estadoAtual;
      }

      return {
        ...estadoAtual,

        [item.id]: {
          ...selecoesProduto,

          [opcaoId]: quantidadeAtual + alteracao,
        },
      };
    });
  }

  function mesclarOpcoesSelecionadas(
    atuais: OpcaoSelecionada[],
    novas: OpcaoSelecionada[],
  ) {
    const mapa = new Map<number, OpcaoSelecionada>();

    atuais.forEach((opcao) => {
      mapa.set(opcao.opcao_id, { ...opcao });
    });

    novas.forEach((opcao) => {
      const existente = mapa.get(opcao.opcao_id);

      if (existente) {
        mapa.set(opcao.opcao_id, {
          ...existente,
          quantidade: existente.quantidade + opcao.quantidade,
        });

        return;
      }

      mapa.set(opcao.opcao_id, { ...opcao });
    });

    return Array.from(mapa.values());
  }

  function adicionarAoCarrinho() {
    if (
      !resultado ||
      !podeContinuar ||
      itensFinais.length === 0 ||
      !opcoesCompletasParaAdicionar
    ) {
      return;
    }

    const produtoSemEstoqueSuficiente = itensFinais.find((item) => {
      const existente = carrinho.find((produto) => produto.id === item.id);

      if (!existente) {
        return false;
      }

      return existente.quantidade + item.quantidade > item.estoque;
    });

    if (produtoSemEstoqueSuficiente) {
      setErro(
        `Você já possui ${produtoSemEstoqueSuficiente.nome} no carrinho e não há estoque suficiente para adicionar essa quantidade.`,
      );

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

            quantidade: existente.quantidade + item.quantidade,

            opcoes_selecionadas: mesclarOpcoesSelecionadas(
              existente.opcoes_selecionadas,
              item.opcoes_selecionadas,
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
    setOpcoesSelecionadasPedido({});
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
        unidades_por_item: item.unidades_por_item ?? 0,
        opcoes: item.opcoes ?? [],

        opcoes_selecionadas: Object.entries(
          opcoesSelecionadasPedido[item.id] ?? {},
        )
          .filter(([, quantidadeOpcao]) => quantidadeOpcao > 0)
          .map(([opcaoId, quantidadeOpcao]) => ({
            opcao_id: Number(opcaoId),

            nome:
              item.opcoes.find((opcao) => opcao.id === Number(opcaoId))?.nome ??
              "Opção",

            quantidade: quantidadeOpcao,
          })),
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
          unidades_por_item: escolha.unidades_por_item ?? 0,
          opcoes: escolha.opcoes ?? [],

          opcoes_selecionadas: Object.entries(
            opcoesSelecionadasPedido[escolha.id] ?? {},
          )
            .filter(([, quantidadeOpcao]) => quantidadeOpcao > 0)
            .map(([opcaoId, quantidadeOpcao]) => ({
              opcao_id: Number(opcaoId),

              nome:
                escolha.opcoes.find((opcao) => opcao.id === Number(opcaoId))
                  ?.nome ?? "Opção",

              quantidade: quantidadeOpcao,
            })),
        };
      })
      .filter((item): item is ItemCarrinho => item !== null);

    return [...encontrados, ...escolhidos];
  })();

  const opcoesCompletasParaAdicionar = itensFinais.every((item) => {
    if (item.unidades_por_item <= 0) {
      return true;
    }

    const totalNecessario = item.quantidade * item.unidades_por_item;

    const totalSelecionado = Object.values(
      opcoesSelecionadasPedido[item.id] ?? {},
    ).reduce((total, quantidade) => total + quantidade, 0);

    return totalSelecionado === totalNecessario;
  });

  const VALOR_MINIMO_PEDIDO = 30;

  const subtotalCarrinho = useMemo(() => {
    return carrinho.reduce(
      (total, item) => total + item.preco * item.quantidade,
      0,
    );
  }, [carrinho]);

  const TAXA_CARTAO = 2;

  const taxaCartao = formaPagamento === "cartao" ? TAXA_CARTAO : 0;

  const totalEstimado = subtotalCarrinho + taxaCartao;

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

  const quantidadeItensCarrinho = carrinho.reduce(
    (total, item) => total + item.quantidade,
    0,
  );

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

  function converterTrocoParaNumero(valor: string) {
    const texto = valor.trim();

    if (!texto) {
      return null;
    }

    const normalizado = texto.includes(",")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto;

    const numero = Number(normalizado);

    return Number.isFinite(numero) ? numero : null;
  }

  async function finalizarPedido() {
    if (enviandoPedido) {
      return;
    }

    setErroFinalizacao("");

    const telefoneLimpo = telefone.replace(/\D/g, "");
    const cepLimpo = cep.replace(/\D/g, "");

    if (!nome.trim()) {
      setErroFinalizacao("Informe seu nome para finalizar o pedido.");
      return;
    }

    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 11) {
      setErroFinalizacao("Confira o número do WhatsApp antes de finalizar.");
      return;
    }

    if (cepLimpo.length !== 8) {
      setErroFinalizacao("Informe um CEP válido.");
      return;
    }

    if (!rua.trim() || !numero.trim() || !bairro.trim()) {
      setErroFinalizacao("Complete o endereço de entrega antes de finalizar.");
      return;
    }

    if (!formaPagamento) {
      setErroFinalizacao("Escolha uma forma de pagamento.");
      return;
    }

    if (carrinho.length === 0) {
      setErroFinalizacao("Seu carrinho está vazio.");
      return;
    }

    if (!podeFinalizarCarrinho) {
      setErroFinalizacao("O pedido ainda não atingiu o valor mínimo.");
      return;
    }

    const trocoNumero =
      formaPagamento === "dinheiro"
        ? converterTrocoParaNumero(trocoPara)
        : null;

    if (
      formaPagamento === "dinheiro" &&
      trocoPara.trim() &&
      (trocoNumero === null || trocoNumero <= 0)
    ) {
      setErroFinalizacao("Informe um valor válido para o troco.");
      return;
    }

    if (
      formaPagamento === "dinheiro" &&
      trocoNumero !== null &&
      trocoNumero < totalEstimado
    ) {
      setErroFinalizacao(
        `O valor para troco deve ser pelo menos ${formatarPreco(
          totalEstimado,
        )}.`,
      );
      return;
    }

    setEnviandoPedido(true);

    try {
      let chaveIdempotencia =
        chaveIdempotenciaRef.current ??
        window.sessionStorage.getItem(
          "deposito-ze-pedido-facil-chave-idempotencia",
        );

      if (!chaveIdempotencia) {
        chaveIdempotencia = crypto.randomUUID();

        window.sessionStorage.setItem(
          "deposito-ze-pedido-facil-chave-idempotencia",
          chaveIdempotencia,
        );
      }

      chaveIdempotenciaRef.current = chaveIdempotencia;

      const formaPagamentoApi =
        formaPagamento === "cartao" ? "cartao_entrega" : formaPagamento;

      const pedidoFinal = {
        chave_idempotencia: chaveIdempotencia,

        nome: nome.trim(),
        telefone: telefone.trim(),

        cep: cep.trim(),
        rua: rua.trim(),
        numero: numero.trim(),

        complemento: complemento.trim() || null,

        bairro: bairro.trim(),

        referencia: referencia.trim() || null,

        forma_pagamento: formaPagamentoApi,

        troco_para: formaPagamento === "dinheiro" ? trocoNumero : null,

        itens: carrinho.map((item) => ({
          id: item.id,

          quantidade: item.quantidade,

          opcoes_selecionadas: item.opcoes_selecionadas.map((opcao) => ({
            opcao_id: opcao.opcao_id,
            quantidade: opcao.quantidade,
          })),
        })),
      };

      const resposta = await fetch("/api/pedidos", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(pedidoFinal),
      });

      const dados = (await resposta.json()) as {
        sucesso?: boolean;
        pedido_id?: number;
        codigo_acesso?: string;
        erro?: string;
      };

      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Não foi possível finalizar o pedido.");
      }

      if (!dados.codigo_acesso) {
        throw new Error(
          "O pedido foi processado, mas não recebemos o código de acesso.",
        );
      }

      window.sessionStorage.removeItem(
        "deposito-ze-pedido-facil-chave-idempotencia",
      );

      chaveIdempotenciaRef.current = null;

      window.location.replace(`/pedido/${dados.codigo_acesso}`);
    } catch (error) {
      setErroFinalizacao(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar o pedido.",
      );
    } finally {
      setEnviandoPedido(false);
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
                    {carrinho.length === 0
                      ? "O que você gostaria de pedir hoje?"
                      : "Quer adicionar mais alguma coisa?"}
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    Escreva ou toque no microfone e fale normalmente.
                  </p>
                </div>
              </div>

              {!resultado && carrinho.length === 0 && (
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
              <div
                id="campo-pedido"
                className="mt-2 border-t border-white/10 pt-4"
              >
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
                    placeholder={
                      carrinho.length === 0
                        ? "Digite seu pedido..."
                        : "Ex: coloca uma Coca 2L também"
                    }
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
            {/* SABORES / OPÇÕES */}
            {itensFinais
              .filter((item) => item.unidades_por_item > 0)
              .map((item, indice) => {
                const totalNecessario =
                  item.quantidade * item.unidades_por_item;

                const selecoesProduto = opcoesSelecionadasPedido[item.id] ?? {};

                const totalSelecionado = Object.values(selecoesProduto).reduce(
                  (total, quantidade) => total + quantidade,
                  0,
                );

                return (
                  <div
                    key={`sabores-${item.id}-${indice}`}
                    className="flex items-end gap-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                      🍺
                    </div>

                    <div className="w-full max-w-[84%] rounded-3xl rounded-bl-md border border-amber-400/20 bg-zinc-900 px-4 py-4">
                      <p className="text-base font-black text-white">
                        Escolha os sabores 👇
                      </p>

                      <p className="mt-1 text-sm font-semibold text-zinc-300">
                        {item.nome}
                      </p>

                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                        <p className="text-sm text-zinc-300">
                          Selecionados:{" "}
                          <strong
                            className={
                              totalSelecionado === totalNecessario
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }
                          >
                            {totalSelecionado} de {totalNecessario}
                          </strong>
                        </p>
                      </div>

                      {item.opcoes.length === 0 ? (
                        <p className="mt-3 text-sm font-bold text-red-300">
                          Nenhum sabor disponível para este produto.
                        </p>
                      ) : (
                        <div className="mt-4 space-y-2">
                          {item.opcoes.map((opcao) => {
                            const quantidade = selecoesProduto[opcao.id] ?? 0;

                            return (
                              <div
                                key={opcao.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-3"
                              >
                                <p className="min-w-0 flex-1 text-sm font-bold text-white">
                                  {opcao.nome}
                                </p>

                                <div className="flex shrink-0 items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={quantidade <= 0}
                                    onClick={() =>
                                      alterarOpcaoPedido(item, opcao.id, -1)
                                    }
                                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-30"
                                    aria-label={`Diminuir ${opcao.nome}`}
                                  >
                                    −
                                  </button>

                                  <strong className="min-w-7 text-center text-lg font-black text-white">
                                    {quantidade}
                                  </strong>

                                  <button
                                    type="button"
                                    disabled={
                                      totalSelecionado >= totalNecessario
                                    }
                                    onClick={() =>
                                      alterarOpcaoPedido(item, opcao.id, 1)
                                    }
                                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-black disabled:cursor-not-allowed disabled:opacity-30"
                                    aria-label={`Aumentar ${opcao.nome}`}
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {totalSelecionado === totalNecessario && (
                        <p className="mt-4 text-sm font-bold text-emerald-400">
                          ✓ Sabores escolhidos
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            {/* ADICIONAR AO CARRINHO */}
            <div className="flex items-end gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xl">
                🍺
              </div>

              <div className="max-w-[84%] rounded-3xl rounded-bl-md border border-white/10 bg-zinc-900 px-4 py-4">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-sm font-bold text-zinc-300">
                    Total desta adição
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

                {resultado.nao_encontrados.length > 0 && (
                  <p className="mt-3 text-sm text-red-300">
                    Resolva os produtos não encontrados antes de adicionar.
                  </p>
                )}
                {podeContinuar && !opcoesCompletasParaAdicionar && (
                  <p className="mt-3 text-sm font-bold text-amber-300">
                    Escolha todos os sabores antes de adicionar ao carrinho.
                  </p>
                )}

                <button
                  type="button"
                  disabled={
                    !podeContinuar ||
                    itensFinais.length === 0 ||
                    !opcoesCompletasParaAdicionar
                  }
                  onClick={adicionarAoCarrinho}
                  className="mt-4 h-12 w-full rounded-2xl bg-amber-400 text-sm font-black text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  🛒 Adicionar ao carrinho
                </button>
              </div>
            </div>
          </section>
        )}
        {carrinho.length > 0 && etapa === "pedido" && (
          <section className="mt-5">
            <div className="rounded-3xl border border-amber-400/20 bg-zinc-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-white">
                    🛒 Seu carrinho
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">
                    Você pode continuar adicionando produtos.
                  </p>
                </div>

                <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-black">
                  {quantidadeItensCarrinho}{" "}
                  {quantidadeItensCarrinho === 1 ? "item" : "itens"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {carrinho.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">
                          {item.nome}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          {formatarPreco(item.preco)} cada
                        </p>
                        {item.opcoes_selecionadas.length > 0 && (
                          <div className="mt-3 rounded-xl border border-white/10 bg-zinc-900 p-3">
                            <p className="mb-2 text-xs font-bold text-zinc-400">
                              Sabores:
                            </p>

                            {item.opcoes_selecionadas.map((opcao) => (
                              <p
                                key={opcao.opcao_id}
                                className="text-sm font-semibold text-zinc-200"
                              >
                                {opcao.quantidade}x {opcao.nome}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removerDoCarrinho(item.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 transition hover:bg-red-500/20"
                        aria-label={`Remover ${item.nome}`}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => alterarQuantidadeCarrinho(item.id, -1)}
                          disabled={
                            item.quantidade <= 1 || item.unidades_por_item > 0
                          }
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-lg font-black text-white disabled:opacity-30"
                          aria-label="Diminuir quantidade"
                        >
                          −
                        </button>

                        <strong className="min-w-8 text-center text-lg font-black text-white">
                          {item.quantidade}
                        </strong>

                        <button
                          type="button"
                          onClick={() => alterarQuantidadeCarrinho(item.id, 1)}
                          disabled={
                            item.quantidade >= item.estoque ||
                            item.unidades_por_item > 0
                          }
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400 text-lg font-black text-black disabled:opacity-30"
                          aria-label="Aumentar quantidade"
                        >
                          +
                        </button>
                      </div>

                      <strong className="text-base font-black text-amber-400">
                        {formatarPreco(item.preco * item.quantidade)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  document.getElementById("campo-pedido")?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
                className="mt-4 h-11 w-full rounded-2xl border border-amber-400/30 text-sm font-black text-amber-300 transition hover:bg-amber-400/10"
              >
                + Adicionar mais produtos
              </button>

              <div className="mt-5 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-black text-white">Subtotal</span>

                  <strong className="text-2xl font-black text-amber-400">
                    {formatarPreco(subtotalCarrinho)}
                  </strong>
                </div>

                {!temExcecaoPedidoMinimoCarrinho &&
                  subtotalCarrinho < VALOR_MINIMO_PEDIDO && (
                    <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                      <p className="text-sm font-bold text-amber-300">
                        Pedido mínimo: R$ 30,00
                      </p>

                      <p className="mt-1 text-sm text-zinc-300">
                        Faltam{" "}
                        <strong className="text-white">
                          {formatarPreco(faltaParaPedidoMinimoCarrinho)}
                        </strong>{" "}
                        para finalizar.
                      </p>
                    </div>
                  )}

                {podeFinalizarCarrinho && (
                  <p className="mt-4 text-sm font-bold text-emerald-400">
                    ✓ Pedido pronto para finalizar
                  </p>
                )}

                <button
                  type="button"
                  disabled={!podeFinalizarCarrinho}
                  onClick={continuarParaDados}
                  className="mt-4 h-12 w-full rounded-2xl bg-emerald-500 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Finalizar pedido →
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
                {formaPagamento === "dinheiro" && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <p className="text-sm font-bold text-white">
                      Precisa de troco?
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Deixe em branco se não precisar.
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="font-bold text-zinc-400">R$</span>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={trocoPara}
                        onChange={(event) =>
                          setTrocoPara(
                            event.target.value.replace(/[^0-9,.]/g, ""),
                          )
                        }
                        placeholder="Ex: 50,00"
                        className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-zinc-950 px-4 text-base text-white outline-none placeholder:text-zinc-600 focus:border-amber-400/50"
                      />
                    </div>
                  </div>
                )}

                {formaPagamento === "cartao" && (
                  <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                    <p className="text-sm font-bold text-amber-300">
                      Cartão na entrega
                    </p>

                    <p className="mt-1 text-sm text-zinc-300">
                      Acréscimo de{" "}
                      <strong className="text-white">
                        {formatarPreco(TAXA_CARTAO)}
                      </strong>{" "}
                      no pedido.
                    </p>
                  </div>
                )}
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
                  {carrinho.map((item) => (
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

                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-400">
                      Produtos
                    </span>

                    <strong className="text-sm text-white">
                      {formatarPreco(subtotalCarrinho)}
                    </strong>
                  </div>

                  {taxaCartao > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-zinc-400">
                        Taxa do cartão
                      </span>

                      <strong className="text-sm text-white">
                        {formatarPreco(taxaCartao)}
                      </strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <span className="font-black text-white">Total</span>

                    <strong className="text-xl font-black text-amber-400">
                      {formatarPreco(totalEstimado)}
                    </strong>
                  </div>

                  {formaPagamento === "dinheiro" && trocoPara.trim() && (
                    <p className="pt-2 text-sm text-zinc-400">
                      Troco para:{" "}
                      <strong className="text-white">R$ {trocoPara}</strong>
                    </p>
                  )}
                </div>
                {erroFinalizacao && (
                  <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                    {erroFinalizacao}
                  </div>
                )}

                <button
                  type="button"
                  onClick={finalizarPedido}
                  disabled={enviandoPedido}
                  className="mt-4 h-12 w-full rounded-2xl bg-emerald-500 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {enviandoPedido ? "Enviando pedido..." : "Confirmar pedido"}
                </button>
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

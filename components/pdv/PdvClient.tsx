"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PdvSaboresModal from "./PdvSaboresModal";

import type {
  PdvCategoria,
  PdvCliente,
  PdvProduto,
} from "../../app/admin/pdv/page";

type Props = {
  produtos: PdvProduto[];
  categorias: PdvCategoria[];
  clientes: PdvCliente[];
};

type ItemCarrinho = {
  id: number;
  nome: string;
  preco: number;
  quantidade: number;
  estoque: number;
  opcoes_selecionadas?: {
    opcao_id: number;
    nome: string;
    quantidade: number;
  }[];
};

type FormaPagamento = "pix" | "dinheiro" | "debito" | "credito";

type RespostaCliente = {
  sucesso?: boolean;
  cliente?: PdvCliente;
  erro?: string;
};

type RespostaVenda = {
  sucesso?: boolean;
  venda_id?: number;
  total?: number;
  erro?: string;
};

const FORMAS_PAGAMENTO: {
  id: FormaPagamento;
  nome: string;
  icone: string;
}[] = [
  { id: "pix", nome: "Pix", icone: "◆" },
  { id: "dinheiro", nome: "Dinheiro", icone: "💵" },
  { id: "debito", nome: "Débito", icone: "💳" },
  { id: "credito", nome: "Crédito", icone: "💳" },
];

function formatarPreco(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function precoAtual(produto: PdvProduto) {
  if (produto.em_promocao && produto.preco_promocional !== null) {
    return produto.preco_promocional;
  }

  return produto.preco;
}

function arredondar(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function converterDinheiro(valor: string) {
  const texto = valor.trim();

  if (!texto) return null;

  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const numero = Number(normalizado);

  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export default function PdvClient({ produtos, categorias, clientes }: Props) {
  const router = useRouter();

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<number | null>(null);
  const [limiteVisivel, setLimiteVisivel] = useState(24);

  const [tipoAtendimento, setTipoAtendimento] = useState<"balcao" | "entrega">(
    "balcao",
  );

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoEmSelecao, setProdutoEmSelecao] = useState<PdvProduto | null>(null);

  const [aviso, setAviso] = useState("");
  const [avisoSucesso, setAvisoSucesso] = useState(false);
  const [erroVenda, setErroVenda] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(
    null,
  );

  const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);

  const [trocoPara, setTrocoPara] = useState("");

  const [clientesDisponiveis, setClientesDisponiveis] =
    useState<PdvCliente[]>(clientes);

  const [clienteSelecionado, setClienteSelecionado] =
    useState<PdvCliente | null>(null);

  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  const [modoNovoCliente, setModoNovoCliente] = useState(false);

  const [buscaCliente, setBuscaCliente] = useState("");
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");

  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const [erroCliente, setErroCliente] = useState("");

  const [enderecoEntrega, setEnderecoEntrega] = useState({
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    complemento: "",
    referencia: "",
  });

  const [carregandoEndereco, setCarregandoEndereco] = useState(false);
  const [mensagemEndereco, setMensagemEndereco] = useState("");
  const buscaEnderecoAtualRef = useRef(0);

  const tentativaRef = useRef<{
    assinatura: string;
    chave: string;
  } | null>(null);

  // FILTROS DE PRODUTOS
  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return produtos.filter((produto) => {
      if (categoria !== null && produto.categoria_id !== categoria) {
        return false;
      }

      if (!termo) return true;

      return (
        produto.nome.toLowerCase().includes(termo) ||
        (produto.codigo_barras ?? "").toLowerCase().includes(termo)
      );
    });
  }, [produtos, categoria, busca]);

  const produtosVisiveis = produtosFiltrados.slice(0, limiteVisivel);

  // FILTROS DE CLIENTES
  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    const numeros = buscaCliente.replace(/\D/g, "");

    return clientesDisponiveis.filter((cliente) => {
      if (!termo) return true;

      const telefone = (
        cliente.telefone_normalizado ?? cliente.telefone
      ).replace(/\D/g, "");

      return (
        cliente.nome.toLowerCase().includes(termo) ||
        (numeros.length > 0 && telefone.includes(numeros))
      );
    });
  }, [clientesDisponiveis, buscaCliente]);

  // TOTAIS
  const quantidadeItens = carrinho.reduce(
    (total, item) => total + item.quantidade,
    0,
  );

  const quantidadeProdutosDiferentes = carrinho.length;

  const subtotal = arredondar(
    carrinho.reduce((total, item) => total + item.preco * item.quantidade, 0),
  );

  // Mantém a taxa prevista na função SQL atual.
  const taxaCartao =
    tipoAtendimento === "entrega" &&
    (formaPagamento === "credito" || formaPagamento === "debito")
      ? 2
      : 0;

  const total = arredondar(subtotal + taxaCartao);

  const valorRecebido = converterDinheiro(trocoPara);

  const troco =
    formaPagamento === "dinheiro" &&
    valorRecebido !== null &&
    valorRecebido >= total
      ? arredondar(valorRecebido - total)
      : null;

  const trocoInvalido =
    formaPagamento === "dinheiro" &&
    trocoPara.trim().length > 0 &&
    (valorRecebido === null || valorRecebido < total);

  // DINHEIRO NÃO PRECISA DO CHECKBOX.
  // PIX E CARTÕES PRECISAM DE CONFIRMAÇÃO.
  const pagamentoPronto =
    formaPagamento === "dinheiro" ||
    (formaPagamento !== null && pagamentoConfirmado);

  const enderecoPronto =
    enderecoEntrega.cep.replace(/\D/g, "").length === 8 &&
    enderecoEntrega.rua.trim().length > 0 &&
    enderecoEntrega.numero.trim().length > 0 &&
    enderecoEntrega.bairro.trim().length > 0;

  const podeFinalizar =
    !finalizando &&
    carrinho.length > 0 &&
    formaPagamento !== null &&
    !trocoInvalido &&
    (tipoAtendimento === "balcao"
      ? pagamentoPronto
      : clienteSelecionado !== null && enderecoPronto);

  function mostrarAviso(mensagem: string, sucesso = false) {
    setAviso(mensagem);
    setAvisoSucesso(sucesso);
  }

  function invalidarConfirmacao() {
    setPagamentoConfirmado(false);
    setErroVenda("");
  }

  function salvarProdutoComSabores(
    produto: PdvProduto,
    quantidade: number,
    opcoes: { opcao_id: number; nome: string; quantidade: number }[],
  ) {
    invalidarConfirmacao();

    setCarrinho((atual) => [
      ...atual.filter((item) => item.id !== produto.id),
      {
        id: produto.id,
        nome: produto.nome,
        preco: precoAtual(produto),
        quantidade,
        estoque: produto.estoque,
        opcoes_selecionadas: opcoes,
      },
    ]);

    setProdutoEmSelecao(null);
    mostrarAviso("Produto e sabores adicionados ao carrinho.", true);
  }
  // ADICIONA PRODUTOS DIFERENTES E SOMA
  // QUANTIDADE SOMENTE QUANDO O ID FOR IGUAL.
  function adicionarProduto(produto: PdvProduto) {
    const produtoId = Number(produto.id);

    if (!Number.isSafeInteger(produtoId) || produtoId <= 0) {
      mostrarAviso("Este produto possui um código inválido.");
      return;
    }

    if (produto.estoque <= 0) {
      mostrarAviso(`${produto.nome} está sem estoque.`);
      return;
    }

    if (produto.unidades_por_item > 0) {
      if (produto.opcoes.length === 0) {
        mostrarAviso("Este produto nao possui sabores ativos.");
        return;
      }

      setProdutoEmSelecao(produto);
      return;
    }

    const existente = carrinho.find((item) => item.id === produtoId);

    if (existente && existente.quantidade >= produto.estoque) {
      mostrarAviso(`Você atingiu o estoque disponível de ${produto.nome}.`);
      return;
    }

    invalidarConfirmacao();

    setCarrinho((carrinhoAtual) => {
      const itemExistente = carrinhoAtual.find((item) => item.id === produtoId);

      if (!itemExistente) {
        // PRODUTO NOVO: CRIA UMA NOVA LINHA
        return [
          ...carrinhoAtual,
          {
            id: produtoId,
            nome: produto.nome,
            preco: precoAtual(produto),
            quantidade: 1,
            estoque: produto.estoque,
          },
        ];
      }

      // MESMO PRODUTO: AUMENTA A QUANTIDADE
      return carrinhoAtual.map((item) => {
        if (item.id !== produtoId) return item;

        return {
          ...item,
          quantidade: Math.min(item.estoque, item.quantidade + 1),
        };
      });
    });

    mostrarAviso(`${produto.nome} adicionado ao carrinho.`, true);
  }

  function alterarQuantidade(id: number, diferenca: 1 | -1) {
    const item = carrinho.find((atual) => atual.id === id);

    if (item?.opcoes_selecionadas?.length) {
      const produto = produtos.find((p) => p.id === id);
      if (produto) setProdutoEmSelecao(produto);
      return;
    }

    invalidarConfirmacao();

    setCarrinho((atual) =>
      atual.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          quantidade: Math.max(
            1,
            Math.min(item.estoque, item.quantidade + diferenca),
          ),
        };
      }),
    );
  }

  function removerProduto(id: number) {
    invalidarConfirmacao();

    setCarrinho((atual) => atual.filter((item) => item.id !== id));

    mostrarAviso("Produto removido do carrinho.");
  }

  function limparVenda() {
    setCarrinho([]);
    setFormaPagamento(null);
    setPagamentoConfirmado(false);
    setTrocoPara("");
    setErroVenda("");
    setAviso("");
    setClienteSelecionado(null);
    limparEnderecoCliente();
    tentativaRef.current = null;
  }

  function selecionarCategoria(id: number | null) {
    setCategoria(id);
    setLimiteVisivel(24);
  }

  function abrirCliente(novo = false) {
    setModoNovoCliente(novo);
    setBuscaCliente("");
    setErroCliente("");
    setModalClienteAberto(true);
  }

  function limparEnderecoCliente() {
    buscaEnderecoAtualRef.current += 1;
    setCarregandoEndereco(false);
    setMensagemEndereco("");

    setEnderecoEntrega({
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      complemento: "",
      referencia: "",
    });
  }

  async function buscarEnderecoCliente(cliente: PdvCliente) {
    const identificadorBusca = ++buscaEnderecoAtualRef.current;

    setEnderecoEntrega({
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      complemento: "",
      referencia: "",
    });

    setCarregandoEndereco(true);
    setMensagemEndereco("Buscando o ultimo endereco utilizado...");

    try {
      const resposta = await fetch(
        `/api/admin/pdv/clientes/endereco?cliente_id=${cliente.id}`,
        { cache: "no-store" },
      );

      const dados = (await resposta.json()) as {
        encontrado?: boolean;
        endereco?: {
          cep: string;
          rua: string;
          numero: string;
          bairro: string;
          complemento: string;
          referencia: string;
        };
        erro?: string;
      };

      if (identificadorBusca !== buscaEnderecoAtualRef.current) {
        return;
      }

      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Falha na consulta.");
      }

      if (!dados.encontrado || !dados.endereco) {
        setMensagemEndereco(
          "Cliente sem endereco anterior encontrado. Preencha os campos manualmente.",
        );
        return;
      }

      setEnderecoEntrega({
        cep: dados.endereco.cep ?? "",
        rua: dados.endereco.rua ?? "",
        numero: dados.endereco.numero ?? "",
        bairro: dados.endereco.bairro ?? "",
        complemento: dados.endereco.complemento ?? "",
        referencia: dados.endereco.referencia ?? "",
      });

      setMensagemEndereco(
        "Endereco anterior carregado. Confirme os dados com o cliente antes de registrar.",
      );

      setErroVenda("");
    } catch {
      if (identificadorBusca === buscaEnderecoAtualRef.current) {
        setMensagemEndereco(
          "Nao foi possivel carregar o endereco anterior. Preencha manualmente.",
        );
      }
    } finally {
      if (identificadorBusca === buscaEnderecoAtualRef.current) {
        setCarregandoEndereco(false);
      }
    }
  }

  function selecionarCliente(cliente: PdvCliente) {
    setClienteSelecionado(cliente);
    setModalClienteAberto(false);
    void buscarEnderecoCliente(cliente);
    invalidarConfirmacao();
  }

  async function cadastrarCliente() {
    if (salvandoCliente) return;

    setErroCliente("");
    setSalvandoCliente(true);

    try {
      const resposta = await fetch("/api/admin/pdv/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: novoClienteNome.trim(),
          telefone: novoClienteTelefone.trim(),
        }),
      });

      const dados = (await resposta.json()) as RespostaCliente;

      if (!resposta.ok || !dados.cliente) {
        throw new Error(dados.erro ?? "Não foi possível cadastrar o cliente.");
      }

      const cliente = dados.cliente;

      setClientesDisponiveis((atual) => {
        const lista = atual.filter((item) => item.id !== cliente.id);

        return [...lista, cliente].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR"),
        );
      });

      setClienteSelecionado(cliente);
      limparEnderecoCliente();
      setMensagemEndereco(
        "Novo cliente cadastrado. Informe o endereco de entrega.",
      );
      setNovoClienteNome("");
      setNovoClienteTelefone("");
      setModalClienteAberto(false);

      invalidarConfirmacao();

      mostrarAviso(`Cliente ${cliente.nome} selecionado.`, true);
    } catch (error) {
      setErroCliente(
        error instanceof Error ? error.message : "Erro ao cadastrar cliente.",
      );
    } finally {
      setSalvandoCliente(false);
    }
  }

  // FINALIZAÇÃO
  async function finalizarVenda() {
    if (finalizando) return;

    setErroVenda("");

    if (tipoAtendimento === "entrega") {
      if (
        !clienteSelecionado ||
        !enderecoPronto ||
        carrinho.length === 0 ||
        !formaPagamento
      ) {
        setErroVenda(
          "Selecione o cliente, informe o endereço completo, os produtos e o pagamento.",
        );
        return;
      }

      if (trocoInvalido) {
        setErroVenda(
          "O valor informado para troco é menor que o total dos produtos.",
        );
        return;
      }

      const pagamentoEntrega =
        formaPagamento === "credito" || formaPagamento === "debito"
          ? "cartao_entrega"
          : formaPagamento;

      const dadosPedido = {
        nome: clienteSelecionado.nome,
        telefone: clienteSelecionado.telefone,
        cep: enderecoEntrega.cep.trim(),
        rua: enderecoEntrega.rua.trim(),
        numero: enderecoEntrega.numero.trim(),
        bairro: enderecoEntrega.bairro.trim(),
        complemento: enderecoEntrega.complemento.trim(),
        referencia: enderecoEntrega.referencia.trim(),
        forma_pagamento: pagamentoEntrega,
        troco_para:
          formaPagamento === "dinheiro" ? valorRecebido : null,
        itens: carrinho.map((item) => ({
          id: item.id,
          quantidade: item.quantidade,
          opcoes_selecionadas: item.opcoes_selecionadas?.map((o) => ({ opcao_id: o.opcao_id, quantidade: o.quantidade })) ?? [],
        })),
      };

      const assinatura = JSON.stringify({
        tipo: "entrega",
        ...dadosPedido,
      });

      if (tentativaRef.current?.assinatura !== assinatura) {
        tentativaRef.current = {
          assinatura,
          chave: crypto.randomUUID(),
        };
      }

      setFinalizando(true);

      try {
        const resposta = await fetch("/api/pedidos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...dadosPedido,
            chave_idempotencia: tentativaRef.current.chave,
          }),
        });

        const dados = (await resposta.json()) as {
          sucesso?: boolean;
          pedido_id?: number;
          erro?: string;
        };

        if (!resposta.ok || !dados.sucesso || !dados.pedido_id) {
          throw new Error(
            dados.erro ?? "Não foi possível registrar a entrega.",
          );
        }

        limparVenda();

        setEnderecoEntrega({
          cep: "",
          rua: "",
          numero: "",
          bairro: "",
          complemento: "",
          referencia: "",
        });

        setTipoAtendimento("balcao");

        mostrarAviso(
          "Pedido de entrega registrado. Confira os dados no painel.",
          true,
        );

        router.push(`/admin/pedidos/${dados.pedido_id}`);
      } catch (error) {
        setErroVenda(
          error instanceof Error
            ? error.message
            : "Não foi possível registrar o pedido.",
        );
      } finally {
        setFinalizando(false);
      }

      return;
    }

    if (carrinho.length === 0) {
      setErroVenda("Adicione produtos ao carrinho.");
      return;
    }

    if (!formaPagamento) {
      setErroVenda("Selecione uma forma de pagamento.");
      return;
    }

    if (!pagamentoPronto) {
      setErroVenda("Confirme o recebimento do pagamento.");
      return;
    }

    if (trocoInvalido) {
      setErroVenda("O valor recebido não pode ser menor que o total.");
      return;
    }

    const assinatura = JSON.stringify({
      itens: carrinho.map((item) => ({
        id: item.id,
        quantidade: item.quantidade,
        opcoes_selecionadas: item.opcoes_selecionadas?.map((o) => ({ opcao_id: o.opcao_id, quantidade: o.quantidade })) ?? [],
      })),
      cliente_id: clienteSelecionado?.id ?? null,
      forma_pagamento: formaPagamento,
      troco_para: formaPagamento === "dinheiro" ? valorRecebido : null,
      total,
    });

    if (tentativaRef.current?.assinatura !== assinatura) {
      tentativaRef.current = {
        assinatura,
        chave: crypto.randomUUID(),
      };
    }

    setFinalizando(true);

    try {
      const resposta = await fetch("/api/admin/pdv/vendas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chave_idempotencia: tentativaRef.current.chave,
          cliente_id: clienteSelecionado?.id ?? null,
          forma_pagamento: formaPagamento,
          pagamento_confirmado: true,
          troco_para: formaPagamento === "dinheiro" ? valorRecebido : null,
          total_esperado: total,
          itens: carrinho.map((item) => ({
            id: item.id,
            quantidade: item.quantidade,
            opcoes_selecionadas: item.opcoes_selecionadas?.map((o) => ({ opcao_id: o.opcao_id, quantidade: o.quantidade })) ?? [],
          })),
        }),
      });

      const dados = (await resposta.json()) as RespostaVenda;

      if (!resposta.ok || !dados.sucesso) {
        throw new Error(dados.erro ?? "Não foi possível finalizar a venda.");
      }

      const numeroVenda = dados.venda_id;
      const totalVenda = dados.total ?? total;

      limparVenda();

      mostrarAviso(
        `Venda #${numeroVenda} registrada! Total: ${formatarPreco(totalVenda)}.`,
        true,
      );

      router.refresh();
    } catch (error) {
      setErroVenda(
        error instanceof Error ? error.message : "Erro ao finalizar a venda.",
      );
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <div className="mt-3 xl:mt-0 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-2 xl:overflow-hidden">
      {/* CABEÇALHO */}
      <section className="shrink-0 rounded-2xl border border-white/10 bg-zinc-950 p-3 shadow-xl xl:p-3">
        <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-xl">
              🧾
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-400">
                Operação de venda
              </p>

              <h1 className="mt-0.5 text-xl font-black text-white xl:text-2xl">
                PDV • Depósito do Zé
              </h1>

              <p className="mt-1 text-xs text-zinc-400 xl:hidden">
                Caixa presencial com estoque integrado ao site.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300"
            >
              ← Painel
            </button>

            <button
              type="button"
              disabled={finalizando}
              onClick={() => abrirCliente(true)}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 disabled:opacity-50"
            >
              👤 Novo cliente
            </button>

            <button
              type="button"
              onClick={() =>
                document.getElementById("pagamento-pdv")?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300"
            >
              💳 Pagamentos
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/produtos/novo")}
              className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-black"
            >
              + Novo produto
            </button>
          </div>
        </div>
      </section>

      {/* AVISOS */}
      {aviso && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-xl border p-4 text-sm font-bold ${
            avisoSucesso
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          <span>{aviso}</span>

          <button
            type="button"
            onClick={() => setAviso("")}
            className="text-lg"
          >
            ×
          </button>
        </div>
      )}

      {erroVenda && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">
          {erroVenda}
        </div>
      )}

      <div className="mt-4 grid gap-3 xl:mt-0 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_380px] xl:overflow-hidden">
        {/* CATÁLOGO */}
        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0d0d0f] p-3 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              autoFocus
              type="text"
              value={busca}
              onChange={(event) => {
                setBusca(event.target.value);
                setLimiteVisivel(24);
              }}
              placeholder="🔎 Buscar produto ou código de barras..."
              className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none focus:border-amber-400/50"
            />

            <button
              type="button"
              onClick={() => {
                setBusca("");
                setCategoria(null);
                setLimiteVisivel(24);
              }}
              className="rounded-2xl border border-white/10 bg-zinc-900 px-5 py-3 text-sm font-bold text-zinc-300"
            >
              Limpar filtros
            </button>
          </div>

          {/* CATEGORIAS */}
          <div className="mt-2 flex shrink-0 gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => selecionarCategoria(null)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${
                categoria === null
                  ? "bg-amber-400 text-black"
                  : "border border-white/10 bg-zinc-900 text-zinc-400"
              }`}
            >
              Todos
            </button>

            {categorias.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selecionarCategoria(item.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-black ${
                  categoria === item.id
                    ? "bg-amber-400 text-black"
                    : "border border-white/10 bg-zinc-900 text-zinc-400"
                }`}
              >
                {item.nome}
              </button>
            ))}
          </div>

          {/* CONTADOR */}
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-white">Produtos</h2>

              <p className="mt-1 text-sm text-zinc-500">
                {produtosFiltrados.length} produto(s) encontrado(s)
              </p>
            </div>

            <p className="hidden rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs font-bold text-amber-300 lg:block xl:hidden">
              Clique em outro produto para adicioná-lo ao carrinho
            </p>
          </div>

          {/* GRADE DE PRODUTOS */}
          <div className="xl:mt-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:overscroll-contain xl:pr-1">
          {produtosFiltrados.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/10 py-12 text-center text-zinc-400">
              Nenhum produto encontrado.
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {produtosVisiveis.map((produto, indice) => {
                  const temOpcoes = produto.unidades_por_item > 0;

                  const quantidadeNoCarrinho =
                    carrinho.find((item) => item.id === Number(produto.id))
                      ?.quantidade ?? 0;

                  return (
                    <button
                      key={produto.id}
                      type="button"
                      disabled={finalizando}
                      onClick={() => adicionarProduto(produto)}
                      aria-label={`Adicionar ${produto.nome} ao carrinho`}
                      className={`group relative min-w-0 overflow-hidden rounded-2xl border bg-zinc-900 text-left transition disabled:opacity-50 ${
                        quantidadeNoCarrinho > 0
                          ? "border-amber-400/70"
                          : "border-white/10 hover:border-amber-400/40"
                      }`}
                    >
                      {/* FOTO */}
                      <div className="relative flex h-24 items-center justify-center bg-black/30 sm:h-24">
                        {produto.imagem_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            loading={indice < 6 ? "eager" : "lazy"}
                            decoding="async"
                            width={240}
                            height={160}
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <span className="text-4xl">🍺</span>
                        )}

                        {produto.em_promocao && (
                          <span className="absolute left-2 top-2 rounded-md bg-red-500 px-2 py-1 text-[9px] font-black text-white">
                            PROMO
                          </span>
                        )}

                        {temOpcoes && (
                          <span className="absolute bottom-2 left-2 rounded-md bg-amber-400 px-2 py-1 text-[9px] font-black text-black">
                            Sabores
                          </span>
                        )}

                        {quantidadeNoCarrinho > 0 && (
                          <span className="absolute right-2 top-2 rounded-lg bg-amber-400 px-2 py-1 text-[10px] font-black text-black">
                            ✓ {quantidadeNoCarrinho}
                          </span>
                        )}
                      </div>

                      {/* NOME E PREÇO */}
                      <div className="p-2.5">
                        <p className="line-clamp-2 min-h-9 text-xs font-black leading-[18px] text-white">
                          {produto.nome}
                        </p>

                        <div className="mt-2 flex flex-wrap items-end justify-between gap-1">
                          <div>
                            {produto.em_promocao &&
                              produto.preco_promocional !== null && (
                                <p className="text-[10px] text-zinc-500 line-through">
                                  {formatarPreco(produto.preco)}
                                </p>
                              )}

                            <p className="text-base font-black text-amber-400">
                              {formatarPreco(precoAtual(produto))}
                            </p>
                          </div>

                          <span
                            className={`rounded-md px-1.5 py-1 text-[9px] font-black ${
                              produto.estoque <= 0
                                ? "bg-red-500/10 text-red-300"
                                : produto.estoque <= 5
                                  ? "bg-orange-500/10 text-orange-300"
                                  : "bg-emerald-500/10 text-emerald-300"
                            }`}
                          >
                            {produto.estoque} un.
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {produtosVisiveis.length < produtosFiltrados.length && (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setLimiteVisivel((atual) => atual + 24)}
                    className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-6 py-3 text-sm font-black text-amber-300"
                  >
                    Mostrar mais produtos (
                    {produtosFiltrados.length - produtosVisiveis.length}{" "}
                    restantes)
                  </button>
                </div>
              )}
            </>
          )}
          </div>
        </section>

        {/* CAIXA */}
        <aside className="min-h-0 xl:overflow-y-auto xl:overscroll-contain">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#101012]">
            {/* TIPO DE ATENDIMENTO */}
            <div className="border-b border-white/10 p-3">
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Tipo de atendimento
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["balcao", "entrega"] as const).map((tipo) => (
                  <button
                    key={tipo}
                    type="button"
                    disabled={finalizando}
                    onClick={() => {
                      setTipoAtendimento(tipo);
                      invalidarConfirmacao();
                    }}
                    className={`h-11 rounded-xl text-xs font-black ${
                      tipoAtendimento === tipo
                        ? "bg-amber-400 text-black"
                        : "border border-white/10 bg-black/30 text-zinc-400"
                    }`}
                  >
                    {tipo === "balcao" ? "🏪 Balcão" : "🛵 Entrega"}
                  </button>
                ))}
              </div>
            </div>

            {/* CARRINHO */}
            <div className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl font-black text-white">Venda atual</h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    {quantidadeProdutosDiferentes}{" "}
                    {quantidadeProdutosDiferentes === 1
                      ? "produto diferente"
                      : "produtos diferentes"}
                    {" • "}
                    {quantidadeItens}{" "}
                    {quantidadeItens === 1 ? "unidade" : "unidades"}
                  </p>
                </div>

                {carrinho.length > 0 && (
                  <button
                    type="button"
                    disabled={finalizando}
                    onClick={limparVenda}
                    className="text-xs font-bold text-red-300 disabled:opacity-50"
                  >
                    Limpar venda
                  </button>
                )}
              </div>

              {carrinho.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-4 text-center">
                  <p className="text-4xl">🛒</p>

                  <p className="mt-3 font-bold text-zinc-400">
                    Selecione um produto no catálogo.
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {carrinho.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">
                            {item.nome}
                          </p>

                          <p className="mt-1 text-xs text-zinc-500">
                            {formatarPreco(item.preco)} cada
                          </p>
                          {item.opcoes_selecionadas?.length ? (
                            <div className="mt-3 space-y-1 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                              <p className="text-xs font-black text-amber-300">
                                Sabores selecionados
                              </p>

                              {item.opcoes_selecionadas.map((opcao) => (
                                <p key={opcao.opcao_id} className="text-xs text-zinc-300">
                                  {opcao.quantidade}x {opcao.nome}
                                </p>
                              ))}

                              <button
                                type="button"
                                disabled={finalizando}
                                onClick={() => {
                                  const produto = produtos.find((p) => p.id === item.id);
                                  if (produto) setProdutoEmSelecao(produto);
                                }}
                                className="mt-2 rounded-lg border border-amber-400/30 px-3 py-2 text-xs font-bold text-amber-300 disabled:opacity-30"
                              >
                                Editar sabores / quantidade
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          disabled={finalizando}
                          onClick={() => removerProduto(item.id)}
                          className="rounded-lg bg-red-500/10 px-3 py-1 text-red-300 disabled:opacity-30"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={finalizando || item.quantidade <= 1}
                            onClick={() => alterarQuantidade(item.id, -1)}
                            className="h-9 w-9 rounded-lg border border-white/10 bg-zinc-800 text-lg font-black disabled:opacity-30"
                          >
                            −
                          </button>

                          <strong className="min-w-6 text-center">
                            {item.quantidade}
                          </strong>

                          <button
                            type="button"
                            disabled={
                              finalizando || item.quantidade >= item.estoque
                            }
                            onClick={() => alterarQuantidade(item.id, 1)}
                            className="h-9 w-9 rounded-lg bg-amber-400 text-lg font-black text-black disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <strong className="font-black text-amber-400">
                          {formatarPreco(item.preco * item.quantidade)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CLIENTES E PAGAMENTO */}
            <div className="border-t border-white/10 bg-black/20 p-3">
              <button
                type="button"
                disabled={finalizando}
                onClick={() => abrirCliente()}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 text-left disabled:opacity-50"
              >
                <div>
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    Cliente
                  </p>

                  <p className="mt-1 text-sm font-black text-white">
                    {clienteSelecionado?.nome ?? "Consumidor não identificado"}
                  </p>

                  {clienteSelecionado && (
                    <p className="mt-1 text-xs text-zinc-400">
                      {clienteSelecionado.telefone}
                    </p>
                  )}
                </div>

                <span className="text-xl text-amber-400">+</span>
              </button>

              {tipoAtendimento === "entrega" && (
                <div className="mt-3 space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-300">
                    Endereço de entrega
                  </p>

                  <p className="text-xs leading-5 text-zinc-400">
                    Entrega grátis em Jardim Pernambuco e Jardim Nova Era,
                    Nova Iguaçu. Outros bairros exigem consulta ao atendimento.
                  </p>

                  {mensagemEndereco && (
                    <p
                      role="status"
                      className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs leading-5 text-amber-200"
                    >
                      {mensagemEndereco}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["cep", "CEP (8 dígitos)"],
                      ["numero", "Número"],
                      ["rua", "Rua"],
                      ["bairro", "Bairro"],
                      ["complemento", "Complemento"],
                      ["referencia", "Referência"],
                    ] as const).map(([campo, titulo]) => (
                      <input
                        key={campo}
                        type="text"
                        value={enderecoEntrega[campo]}
                        onChange={(event) => {
                          setEnderecoEntrega((anterior) => ({
                            ...anterior,
                            [campo]: event.target.value,
                          }));
                          setErroVenda("");
                        }}
                        disabled={finalizando || carregandoEndereco}
                        placeholder={titulo}
                        aria-label={titulo}
                        className="min-w-0 rounded-lg border border-white/10 bg-zinc-950 p-2 text-sm text-white outline-none focus:border-amber-400"
                      />
                    ))}
                  </div>

                  {!clienteSelecionado && (
                    <p className="text-xs text-amber-300">
                      Selecione ou cadastre um cliente para esta entrega.
                    </p>
                  )}
                </div>
              )}

              {/* PAGAMENTO */}
              <div id="pagamento-pdv" className="mt-3">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                  Forma de pagamento
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {FORMAS_PAGAMENTO.map((forma) => (
                    <button
                      key={forma.id}
                      type="button"
                      disabled={finalizando}
                      onClick={() => {
                        setFormaPagamento(forma.id);
                        setTrocoPara("");
                        invalidarConfirmacao();
                      }}
                      className={`rounded-xl border px-3 py-3 text-sm font-black transition ${
                        formaPagamento === forma.id
                          ? "border-amber-400 bg-amber-400 text-black"
                          : "border-white/10 bg-zinc-900 text-zinc-300"
                      }`}
                    >
                      {forma.icone} {forma.nome}
                    </button>
                  ))}
                </div>

                {tipoAtendimento === "balcao" && formaPagamento === "credito" && (
                  <p className="mt-2 text-xs font-bold text-amber-300">
                    Crédito no balcão: sem taxa adicional.
                  </p>
                )}

                {/* DINHEIRO */}
                {formaPagamento === "dinheiro" && (
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-bold text-zinc-400">
                      Valor recebido (opcional para calcular troco)
                    </label>

                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={finalizando}
                      value={trocoPara}
                      onChange={(event) => {
                        setTrocoPara(event.target.value);
                        setErroVenda("");
                      }}
                      placeholder="Ex.: 50,00"
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none focus:border-amber-400"
                    />

                    {troco !== null && (
                      <p className="mt-2 text-sm font-bold text-emerald-300">
                        Troco: {formatarPreco(troco)}
                      </p>
                    )}

                    {trocoInvalido && (
                      <p className="mt-2 text-xs font-bold text-red-300">
                        O valor informado é menor que o total.
                      </p>
                    )}

                    <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-zinc-400">
                      {tipoAtendimento === "balcao"
                        ? "Ao finalizar, você confirma o recebimento em dinheiro."
                        : "Para entrega, informe o troco se necessário. O pagamento será tratado pelo fluxo do pedido."}
                    </p>
                  </div>
                )}

                {/* CONFIRMAÇÃO ESPECÍFICA PARA PIX */}
                {tipoAtendimento === "balcao" && formaPagamento === "pix" && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <input
                      type="checkbox"
                      checked={pagamentoConfirmado}
                      disabled={finalizando}
                      onChange={(event) =>
                        setPagamentoConfirmado(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 accent-amber-400"
                    />

                    <span className="text-sm leading-5 text-zinc-300">
                      Confirmo que o Pix foi recebido e que conferi o crédito na
                      conta da loja.
                    </span>
                  </label>
                )}

                {/* CONFIRMAÇÃO PARA CARTÕES */}
                {tipoAtendimento === "balcao" && (formaPagamento === "debito" ||
                  formaPagamento === "credito") && (
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <input
                      type="checkbox"
                      checked={pagamentoConfirmado}
                      disabled={finalizando}
                      onChange={(event) =>
                        setPagamentoConfirmado(event.target.checked)
                      }
                      className="mt-1 h-4 w-4 accent-amber-400"
                    />

                    <span className="text-sm leading-5 text-zinc-300">
                      Confirmo que o pagamento foi autorizado na maquininha.
                    </span>
                  </label>
                )}
              </div>

              {/* RESUMO DA VENDA */}
              <div className="mt-3 border-t border-white/10 pt-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span>{formatarPreco(subtotal)}</span>
                  </div>

                  {taxaCartao > 0 && (
                    <div className="flex justify-between text-zinc-400">
                      <span>Taxa do cartão</span>
                      <span>{formatarPreco(taxaCartao)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-zinc-500">
                      Total da venda
                    </p>

                    <p className="mt-1 text-4xl font-black text-white">
                      {formatarPreco(total)}
                    </p>
                  </div>

                  <span className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300">
                    {tipoAtendimento === "balcao" ? "BALCÃO" : "ENTREGA"}
                  </span>
                </div>

                {tipoAtendimento === "entrega" && (
                  <p className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-200">
                    A entrega será registrada como pedido do site, com validação
                    de CEP, pedido mínimo e estoque. Não será contabilizada como
                    venda presencial no caixa.
                  </p>
                )}

                <button
                  type="button"
                  disabled={!podeFinalizar}
                  onClick={finalizarVenda}
                  className="mt-3 h-12 w-full rounded-xl bg-emerald-500 text-sm font-black text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {finalizando
                    ? "Registrando..."
                    : tipoAtendimento === "entrega"
                      ? "✓ Registrar pedido de entrega"
                      : formaPagamento === "dinheiro"
                        ? "✓ Finalizar venda em dinheiro"
                        : "✓ Finalizar venda"}
                </button>

                {tipoAtendimento === "balcao" && !formaPagamento && (
                  <p className="mt-2 text-center text-xs text-zinc-500">
                    Escolha uma forma de pagamento.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {produtoEmSelecao && (
        <PdvSaboresModal
          produto={produtoEmSelecao}
          item={carrinho.find((item) => item.id === produtoEmSelecao.id)}
          onFechar={() => setProdutoEmSelecao(null)}
          onSalvar={salvarProdutoComSabores}
        />
      )}
      {/* MODAL DE CLIENTES */}
      {modalClienteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cliente"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 id="titulo-cliente" className="text-xl font-black">
                Clientes
              </h2>

              <button
                type="button"
                onClick={() => setModalClienteAberto(false)}
                className="rounded-lg bg-white/10 px-3 py-2 text-lg"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setModoNovoCliente(false);
                  setErroCliente("");
                }}
                className={`rounded-xl p-3 text-sm font-bold ${
                  !modoNovoCliente
                    ? "bg-amber-400 text-black"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                Selecionar
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoNovoCliente(true);
                  setErroCliente("");
                }}
                className={`rounded-xl p-3 text-sm font-bold ${
                  modoNovoCliente
                    ? "bg-amber-400 text-black"
                    : "bg-zinc-800 text-zinc-300"
                }`}
              >
                Cadastrar novo
              </button>
            </div>

            {erroCliente && (
              <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300">
                {erroCliente}
              </p>
            )}

            {modoNovoCliente ? (
              <form
                className="mt-5 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void cadastrarCliente();
                }}
              >
                <input
                  required
                  value={novoClienteNome}
                  onChange={(event) => setNovoClienteNome(event.target.value)}
                  placeholder="Nome do cliente"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 outline-none focus:border-amber-400"
                />

                <input
                  required
                  type="tel"
                  value={novoClienteTelefone}
                  onChange={(event) =>
                    setNovoClienteTelefone(event.target.value)
                  }
                  placeholder="Telefone com DDD"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 outline-none focus:border-amber-400"
                />

                <button
                  type="submit"
                  disabled={salvandoCliente}
                  className="h-12 w-full rounded-xl bg-amber-400 font-black text-black disabled:opacity-50"
                >
                  {salvandoCliente ? "Salvando..." : "Cadastrar e selecionar"}
                </button>
              </form>
            ) : (
              <>
                <input
                  value={buscaCliente}
                  onChange={(event) => setBuscaCliente(event.target.value)}
                  placeholder="Buscar nome ou telefone..."
                  className="mt-5 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 outline-none focus:border-amber-400"
                />

                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      Nenhum cliente encontrado.
                    </p>
                  ) : (
                    clientesFiltrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        onClick={() => selecionarCliente(cliente)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:border-amber-400/40"
                      >
                        <p className="text-sm font-black">{cliente.nome}</p>

                        <p className="mt-1 text-xs text-zinc-400">
                          {cliente.telefone}
                        </p>
                      </button>
                    ))
                  )}
                </div>

                {clienteSelecionado && (
                  <button
                    type="button"
                    onClick={() => {
                      setClienteSelecionado(null);
                      limparEnderecoCliente();
                      setModalClienteAberto(false);
                      invalidarConfirmacao();
                    }}
                    className="mt-4 w-full rounded-xl border border-white/10 p-3 text-sm font-bold text-zinc-300"
                  >
                    Remover cliente da venda
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

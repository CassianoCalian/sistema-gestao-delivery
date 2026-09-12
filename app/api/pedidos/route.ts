import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type ItemRecebido = {
  id: number;
  quantidade: number;
};

type PedidoRecebido = {
  nome: string;
  telefone: string;

  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  referencia?: string;

  forma_pagamento: string;
  troco_para?: number | null;
  chave_idempotencia: string;
  pontos_fidelidade?: number;

  itens: ItemRecebido[];
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PedidoRecebido;

    const {
      nome,
      telefone,
      chave_idempotencia,
      pontos_fidelidade,
      cep,
      rua,
      numero,
      complemento,
      bairro,
      referencia,
      forma_pagamento,
      troco_para,
      itens,
    } = body;

    // 1. Validações básicas
    if (!nome?.trim()) {
      return NextResponse.json(
        { erro: "Informe o nome do cliente." },
        { status: 400 },
      );
    }

    if (!telefone?.trim()) {
      return NextResponse.json(
        { erro: "Informe o telefone." },
        { status: 400 },
      );
    }

    if (!cep?.trim() || !rua?.trim() || !numero?.trim() || !bairro?.trim()) {
      return NextResponse.json(
        { erro: "Preencha o endereço de entrega." },
        { status: 400 },
      );
    }
    const uuidValido =
      typeof chave_idempotencia === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        chave_idempotencia,
      );

    if (!uuidValido) {
      return NextResponse.json(
        {
          erro: "Identificador do pedido inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      return NextResponse.json(
        {
          erro: "Informe um CEP válido com 8 números.",
        },
        {
          status: 400,
        },
      );
    }

    let enderecoCep: ViaCepResponse;

    try {
      const respostaCep = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`,
        {
          cache: "no-store",
        },
      );

      if (!respostaCep.ok) {
        return NextResponse.json(
          {
            erro: "Não foi possível validar o CEP informado.",
          },
          {
            status: 502,
          },
        );
      }

      enderecoCep = (await respostaCep.json()) as ViaCepResponse;
    } catch (error) {
      console.error("Erro ao validar CEP no pedido:", error);

      return NextResponse.json(
        {
          erro: "Não foi possível validar o endereço neste momento.",
        },
        {
          status: 502,
        },
      );
    }

    if (enderecoCep.erro) {
      return NextResponse.json(
        {
          erro: "CEP não encontrado.",
        },
        {
          status: 400,
        },
      );
    }

    const bairroCep = enderecoCep.bairro?.trim() ?? "";
    const cidadeCep = enderecoCep.localidade?.trim() ?? "";
    const ufCep = enderecoCep.uf?.trim().toUpperCase() ?? "";

    if (!bairroCep) {
      return NextResponse.json(
        {
          erro: "Não foi possível identificar o bairro deste CEP.",
        },
        {
          status: 400,
        },
      );
    }

    const bairrosPermitidos = ["jardim pernambuco", "jardim nova era"];

    const bairroCepNormalizado = normalizarTexto(bairroCep);
    const cidadeCepNormalizada = normalizarTexto(cidadeCep);

    const enderecoDentroDaArea =
      cidadeCepNormalizada === "nova iguacu" &&
      ufCep === "RJ" &&
      bairrosPermitidos.includes(bairroCepNormalizado);

    if (!enderecoDentroDaArea) {
      return NextResponse.json(
        {
          erro: "Este endereço está fora da nossa área de entrega grátis. Para outros bairros, realizamos entregas via Uber Flash. Consulte o valor pelo WhatsApp.",
        },
        {
          status: 400,
        },
      );
    }

    const bairroConfirmado = bairroCep;

    const ruaConfirmada = enderecoCep.logradouro?.trim() || rua.trim();

    const formasPermitidas = ["pix", "cartao_entrega", "dinheiro"];

    if (!formasPermitidas.includes(forma_pagamento)) {
      return NextResponse.json(
        { erro: "Forma de pagamento inválida." },
        { status: 400 },
      );
    }

    const trocoParaNumero =
      forma_pagamento === "dinheiro" &&
      troco_para !== null &&
      troco_para !== undefined
        ? Number(troco_para)
        : null;

    if (
      forma_pagamento === "dinheiro" &&
      trocoParaNumero !== null &&
      (!Number.isFinite(trocoParaNumero) || trocoParaNumero <= 0)
    ) {
      return NextResponse.json(
        { erro: "Informe um valor válido para o troco." },
        { status: 400 },
      );
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { erro: "O carrinho está vazio." },
        { status: 400 },
      );
    }

    for (const item of itens) {
      if (
        !Number.isInteger(item.id) ||
        !Number.isInteger(item.quantidade) ||
        item.quantidade <= 0
      ) {
        return NextResponse.json(
          { erro: "Existe um item inválido no carrinho." },
          { status: 400 },
        );
      }
    }

    const pontosFidelidadeNumero = Number(pontos_fidelidade ?? 0);

    if (
      !Number.isInteger(pontosFidelidadeNumero) ||
      pontosFidelidadeNumero < 0
    ) {
      return NextResponse.json(
        {
          erro: "Quantidade de pontos de fidelidade inválida.",
        },
        {
          status: 400,
        },
      );
    }

    if (pontosFidelidadeNumero % 500 !== 0) {
      return NextResponse.json(
        {
          erro: "Os pontos devem ser utilizados em blocos de 500.",
        },
        {
          status: 400,
        },
      );
    }
    // A partir daqui, criação do pedido, cálculo dos preços,
    // gravação dos itens e baixa de estoque acontecem
    // dentro de uma única transação no PostgreSQL.

    const { data, error } = await supabaseAdmin.rpc(
      "criar_pedido_com_estoque",
      {
        p_nome: nome.trim(),
        p_telefone: telefone.trim(),
        p_cep: cep.trim(),
        p_rua: rua.trim(),
        p_numero: numero.trim(),
        p_complemento: complemento?.trim() || null,
        p_bairro: bairroConfirmado,
        p_referencia: referencia?.trim() || null,
        p_forma_pagamento: forma_pagamento,
        p_troco_para: trocoParaNumero,

        p_itens: itens.map((item) => ({
          id: item.id,
          quantidade: item.quantidade,
        })),

        p_pontos_fidelidade: pontosFidelidadeNumero,

        p_chave_idempotencia: chave_idempotencia,
      },
    );

    if (error) {
      console.error("Erro ao criar pedido:", error);

      const mensagem = error.message ?? "";

      if (mensagem.includes("CARRINHO_VAZIO")) {
        return NextResponse.json(
          { erro: "O carrinho está vazio." },
          { status: 400 },
        );
      }

      if (mensagem.includes("ITEM_INVALIDO")) {
        return NextResponse.json(
          { erro: "Existe um item inválido no carrinho." },
          { status: 400 },
        );
      }

      if (mensagem.includes("PRODUTO_NAO_ENCONTRADO")) {
        return NextResponse.json(
          { erro: "Um ou mais produtos não foram encontrados." },
          { status: 400 },
        );
      }

      if (mensagem.includes("PRODUTO_INATIVO:")) {
        const nomeProduto = mensagem.split("PRODUTO_INATIVO:")[1]?.trim();

        return NextResponse.json(
          {
            erro: nomeProduto
              ? `${nomeProduto} não está mais disponível.`
              : "Um dos produtos não está mais disponível.",
          },
          { status: 400 },
        );
      }

      if (mensagem.includes("ESTOQUE_INSUFICIENTE:")) {
        const parte = mensagem.split("ESTOQUE_INSUFICIENTE:")[1] ?? "";

        const [nomeProduto, estoqueDisponivel] = parte.split(":");

        return NextResponse.json(
          {
            erro:
              nomeProduto && estoqueDisponivel
                ? `Estoque insuficiente para ${nomeProduto}. Disponível: ${estoqueDisponivel}.`
                : "Estoque insuficiente para um dos produtos.",
          },
          { status: 400 },
        );
      }

      if (mensagem.includes("PEDIDO_MINIMO:")) {
        return NextResponse.json(
          {
            erro: "O pedido mínimo para entrega é de R$ 30,00. Adicione mais produtos ao carrinho para continuar.",
          },
          { status: 400 },
        );
      }

      if (mensagem.includes("pedidos_troco_valido")) {
        return NextResponse.json(
          {
            erro: "O valor para troco não pode ser menor que o total do pedido.",
          },
          { status: 400 },
        );
      }

      if (mensagem.includes("PONTOS_FIDELIDADE_INVALIDOS")) {
        return NextResponse.json(
          {
            erro: "A quantidade de pontos informada é inválida.",
          },
          {
            status: 400,
          },
        );
      }

      if (mensagem.includes("PONTOS_FIDELIDADE_DEVE_SER_MULTIPLO_DE_500")) {
        return NextResponse.json(
          {
            erro: "Os pontos devem ser utilizados em blocos de 500.",
          },
          {
            status: 400,
          },
        );
      }

      if (mensagem.includes("SALDO_PONTOS_INSUFICIENTE")) {
        return NextResponse.json(
          {
            erro: "Seu saldo de pontos mudou e não é mais suficiente para este desconto. Consulte novamente seus pontos.",
          },
          {
            status: 400,
          },
        );
      }

      if (mensagem.includes("DESCONTO_FIDELIDADE_SUPERA_SUBTOTAL")) {
        return NextResponse.json(
          {
            erro: "O desconto de fidelidade selecionado é maior que o valor dos produtos.",
          },
          {
            status: 400,
          },
        );
      }

      if (mensagem.includes("CLIENTE_NAO_ENCONTRADO")) {
        return NextResponse.json(
          {
            erro: "Não foi possível localizar o cadastro do cliente para aplicar a fidelidade.",
          },
          {
            status: 400,
          },
        );
      }

      return NextResponse.json(
        {
          erro: "Não foi possível finalizar o pedido.",
        },
        { status: 500 },
      );
    }

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado) {
      return NextResponse.json(
        {
          erro: "O pedido não retornou os dados esperados.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        sucesso: true,
        pedido_id: resultado.pedido_id,
        codigo_acesso: resultado.codigo_acesso,
        subtotal: Number(resultado.subtotal),
        taxa_entrega: Number(resultado.taxa_entrega),
        total: Number(resultado.total),
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erro inesperado:", error);

    return NextResponse.json(
      { erro: "Erro interno ao processar o pedido." },
      { status: 500 },
    );
  }
}

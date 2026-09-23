import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

type OpcaoProduto = {
  id: number;
  nome: string;
  ativo: boolean;
  ordem: number;
};

type Produto = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  preco_promocional: number | null;
  estoque: number;
  em_promocao: boolean;
  permite_abaixo_minimo: boolean;
  unidades_por_item: number;
  opcoes: OpcaoProduto[] | null;
};

const numerosPorExtenso: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
};

const palavrasIgnoradas = new Set([
  "quero",
  "queria",
  "manda",
  "mande",
  "mandar",
  "me",
  "da",
  "de",
  "do",
  "das",
  "dos",
  "um",
  "uma",
  "uns",
  "umas",
  "por",
  "favor",
  "pra",
  "para",
  "aqui",
  "tambem",
  "mais",
  "unidade",
  "unidades",
  "gelada",
  "gelado",
  "un",
]);

const palavrasMedida = new Set(["l", "litro", "litros", "ml"]);

const formatosMultipack = new Set(["pack", "caixa", "fardo", "combo", "kit"]);

const formatosProduto = new Set([
  "pack",
  "caixa",
  "fardo",
  "combo",
  "kit",
  "latao",
  "lata",
  "long",
  "neck",
  "garrafa",
  "chopinho",
]);

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function descobrirPagamento(texto: string) {
  const mensagem = normalizar(texto);

  if (mensagem.includes("pix")) {
    return "pix";
  }

  if (
    mensagem.includes("cartao") ||
    mensagem.includes("credito") ||
    mensagem.includes("debito")
  ) {
    return "cartao";
  }

  if (mensagem.includes("dinheiro") || mensagem.includes("especie")) {
    return "dinheiro";
  }

  return null;
}

function separarItens(mensagem: string) {
  /*
   * IMPORTANTE:
   * separamos ANTES de normalizar.
   *
   * Assim a vírgula ainda existe.
   */
  const texto = mensagem
    .replace(
      /\b(vou pagar|pagamento|vou pagar no|vou pagar em|pagar no|pagar em)\b.*$/i,
      "",
    )
    .trim();

  const partes = texto
    .split(/\s*,\s*|\s+\be\b\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean);

  return partes;
}

function descobrirQuantidade(trecho: string) {
  const palavras = normalizar(trecho).split(" ");

  for (const palavra of palavras.slice(0, 6)) {
    const numero = Number(palavra);

    if (Number.isInteger(numero) && numero > 0) {
      return numero;
    }

    if (numerosPorExtenso[palavra]) {
      return numerosPorExtenso[palavra];
    }
  }

  return 1;
}

function palavrasImportantes(trecho: string) {
  return normalizar(trecho)
    .split(" ")
    .filter((palavra) => {
      if (!palavra) {
        return false;
      }

      if (palavrasIgnoradas.has(palavra)) {
        return false;
      }

      if (palavrasMedida.has(palavra)) {
        return false;
      }

      if (numerosPorExtenso[palavra]) {
        return false;
      }

      if (/^\d+$/.test(palavra)) {
        return false;
      }

      return palavra.length >= 2;
    });
}

type Medida = {
  quantidade: number;
  unidade: "ml";
};

function extrairMedida(texto: string): Medida | null {
  const normalizado = normalizar(texto);

  /*
   * Ex:
   * 350ml
   * 350 ml
   */
  const ml = normalizado.match(/\b(\d+)\s*ml\b/);

  if (ml) {
    return {
      quantidade: Number(ml[1]),
      unidade: "ml",
    };
  }

  /*
   * Ex:
   * 2l
   * 2 l
   * 2 litros
   * 2 litro
   */
  const litros = normalizado.match(/\b(\d+)\s*(?:l|litro|litros)\b/);

  if (litros) {
    return {
      quantidade: Number(litros[1]) * 1000,
      unidade: "ml",
    };
  }

  return null;
}

function produtoRespeitaMedida(trecho: string, produto: Produto) {
  const medidaPedido = extrairMedida(trecho);

  /*
   * Cliente não informou medida.
   * Não filtramos por tamanho.
   */
  if (!medidaPedido) {
    return true;
  }

  const medidaProduto = extrairMedida(produto.nome);

  /*
   * Se o cliente pediu explicitamente 2L,
   * um produto sem tamanho conhecido não
   * deve ser escolhido automaticamente.
   */
  if (!medidaProduto) {
    return false;
  }

  return medidaPedido.quantidade === medidaProduto.quantidade;
}

function possuiPalavraPrincipal(trecho: string, produto: Produto) {
  const palavrasPedido = palavrasImportantes(trecho);

  const palavrasProduto = palavrasImportantes(produto.nome);

  if (palavrasPedido.length === 0) {
    return false;
  }

  return palavrasPedido.some((palavraPedido) =>
    palavrasProduto.some(
      (palavraProduto) =>
        palavraProduto === palavraPedido ||
        palavraProduto.includes(palavraPedido) ||
        palavraPedido.includes(palavraProduto),
    ),
  );
}

function calcularPontuacao(trecho: string, produto: Produto) {
  if (!produtoRespeitaMedida(trecho, produto)) {
    return 0;
  }

  const palavrasPedido = palavrasImportantes(trecho);

  const palavrasProduto = palavrasImportantes(produto.nome);

  /*
   * Separa:
   *
   * "heineken pack"
   *
   * Marca/principal: heineken
   * Formato: pack
   */
  const formatosSolicitados = palavrasPedido.filter((palavra) =>
    formatosProduto.has(palavra),
  );

  const termosPrincipais = palavrasPedido.filter(
    (palavra) => !formatosProduto.has(palavra),
  );

  function produtoPossui(termo: string) {
    return palavrasProduto.some(
      (palavraProduto) =>
        palavraProduto === termo ||
        palavraProduto.includes(termo) ||
        termo.includes(palavraProduto),
    );
  }

  /*
   * A marca / produto principal é
   * obrigatório.
   *
   * Portanto:
   *
   * HEINEKEN PACK
   *
   * jamais pode encontrar:
   *
   * PACK AMSTEL
   * PACK ANTARCTICA
   */
  if (
    termosPrincipais.length > 0 &&
    !termosPrincipais.every((termo) => produtoPossui(termo))
  ) {
    return 0;
  }

  /*
   * Se o cliente falou um formato,
   * ele também é obrigatório.
   *
   * Ex:
   *
   * "Heineken pack"
   *
   * não aceita:
   *
   * Heineken Long Neck
   * Heineken Latão
   */
  if (
    formatosSolicitados.length > 0 &&
    !formatosSolicitados.every((formato) => produtoPossui(formato))
  ) {
    return 0;
  }

  /*
   * Se o cliente NÃO pediu pack,
   * caixa, fardo etc., não mostramos
   * multipacks.
   *
   * Assim:
   *
   * "duas Heineken"
   *
   * significa unidades.
   */
  if (formatosSolicitados.length === 0) {
    const produtoEhMultipack = palavrasProduto.some((palavra) =>
      formatosMultipack.has(palavra),
    );

    if (produtoEhMultipack) {
      return 0;
    }
  }

  let pontos = 0;

  /*
   * Marca/nome têm peso alto.
   */
  for (const termo of termosPrincipais) {
    for (const palavraProduto of palavrasProduto) {
      if (termo === palavraProduto) {
        pontos += 15;
        continue;
      }

      if (palavraProduto.includes(termo) || termo.includes(palavraProduto)) {
        pontos += 6;
      }
    }
  }

  /*
   * Formato solicitado também
   * aumenta bastante a precisão.
   */
  for (const formato of formatosSolicitados) {
    if (produtoPossui(formato)) {
      pontos += 15;
    }
  }

  /*
   * Tamanho.
   *
   * Ex:
   *
   * Coca 2L
   * Heineken 473ml
   */
  const medidaPedido = extrairMedida(trecho);

  const medidaProduto = extrairMedida(produto.nome);

  if (
    medidaPedido &&
    medidaProduto &&
    medidaPedido.quantidade === medidaProduto.quantidade
  ) {
    pontos += 20;
  }

  return pontos;
}

function precoAtual(produto: Produto) {
  const preco = Number(produto.preco);

  const promocional =
    produto.preco_promocional !== null
      ? Number(produto.preco_promocional)
      : null;

  if (produto.em_promocao && promocional !== null) {
    return promocional;
  }

  return preco;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const mensagem =
      typeof body?.mensagem === "string" ? body.mensagem.trim() : "";

    if (!mensagem) {
      return NextResponse.json(
        {
          erro: "Informe o pedido.",
        },
        {
          status: 400,
        },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("produtos")
      .select(
        `
    id,
    nome,
    descricao,
    preco,
    preco_promocional,
    estoque,
    em_promocao,
    unidades_por_item,
    permite_abaixo_minimo,
    opcoes:produto_opcoes (
      id,
      nome,
      ativo,
      ordem
    )
  `,
      )
      .eq("ativo", true)
      .gt("estoque", 0)
      .order("nome", {
        ascending: true,
      });

    if (error) {
      console.error("Erro ao consultar produtos:", error);

      return NextResponse.json(
        {
          erro: "Não foi possível consultar os produtos.",
        },
        {
          status: 500,
        },
      );
    }

    const produtos = (data ?? []) as Produto[];

    const trechos = separarItens(mensagem);

    const itensEncontrados = [];

    const duvidas = [];

    const naoEncontrados = [];

    for (const trecho of trechos) {
      const quantidade = descobrirQuantidade(trecho);

      const candidatos = produtos
        .map((produto) => ({
          produto,
          pontuacao: calcularPontuacao(trecho, produto),
        }))
        .filter(({ pontuacao }) => pontuacao > 0)
        .sort((a, b) => b.pontuacao - a.pontuacao);

      if (candidatos.length === 0) {
        naoEncontrados.push({
          trecho,
          quantidade,
        });

        continue;
      }

      const melhor = candidatos[0];

      const segundo = candidatos[1];

      /*
       * Só escolhemos automaticamente
       * quando o melhor resultado ficou
       * claramente na frente.
       */
      const ambiguo = segundo && melhor.pontuacao - segundo.pontuacao <= 3;

      if (ambiguo) {
        duvidas.push({
          trecho,
          quantidade,

          opcoes: candidatos
            .filter((candidato) => melhor.pontuacao - candidato.pontuacao <= 5)
            .slice(0, 5)
            .map(({ produto }) => ({
              id: produto.id,
              nome: produto.nome,
              preco: precoAtual(produto),
              estoque: produto.estoque,
              permite_abaixo_minimo: produto.permite_abaixo_minimo,
              unidades_por_item: produto.unidades_por_item ?? 0,
              opcoes:
                produto.opcoes
                  ?.filter((opcao) => opcao.ativo)
                  .sort((a, b) => a.ordem - b.ordem) ?? [],
            })),
        });

        continue;
      }

      const produto = melhor.produto;

      const preco = precoAtual(produto);

      itensEncontrados.push({
        id: produto.id,

        nome: produto.nome,

        quantidade,

        preco,

        subtotal: preco * quantidade,

        estoque: produto.estoque,

        unidades_por_item: produto.unidades_por_item,

        permite_abaixo_minimo: produto.permite_abaixo_minimo,
        opcoes:
          produto.opcoes
            ?.filter((opcao) => opcao.ativo)
            .sort((a, b) => a.ordem - b.ordem) ?? [],
      });
    }

    const subtotal = itensEncontrados.reduce(
      (total, item) => total + item.subtotal,
      0,
    );

    return NextResponse.json({
      sucesso: true,

      mensagem_original: mensagem,

      forma_pagamento: descobrirPagamento(mensagem),

      partes_interpretadas: trechos,

      itens: itensEncontrados,

      duvidas,

      nao_encontrados: naoEncontrados,

      subtotal,
    });
  } catch (error) {
    console.error("Erro no Pedido Fácil:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao interpretar o pedido.",
      },
      {
        status: 500,
      },
    );
  }
}

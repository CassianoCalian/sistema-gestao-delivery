import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Situacao = "novo" | "existente" | "revisar" | "ignorar";

type ProdutoExcel = {
  linha: number;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  ativoAntigo: boolean;
  categoriaAntiga: string;
};

type ProdutoBanco = {
  id: number;
  nome: string;
  codigo_barras: string | null;
};

type Categoria = {
  id: number;
  nome: string;
  slug: string;
};

function normalizar(valor: string): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/(\d+)\s+(ML|KG|L|G)\b/g, "$1$2")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function limparCodigo(valor: string): string {
  const codigo = String(valor ?? "").replace(/\D/g, "");

  if (codigo.length < 8 || codigo.length > 14) {
    return "";
  }

  if (/^(\d)\1+$/.test(codigo)) {
    return "";
  }

  return codigo;
}

function codigoIgual(a: string, b: string): boolean {
  const x = limparCodigo(a).replace(/^0+/, "");
  const y = limparCodigo(b).replace(/^0+/, "");

  return Boolean(x && y && x === y);
}

function parecido(a: string, b: string): boolean {
  const ignorar = new Set([
    "CERVEJA",
    "REFRIGERANTE",
    "GELADA",
    "GELADO",
    "UNIDADE",
    "UN",
    "UND",
    "DE",
    "DA",
    "DO",
  ]);

  const palavras = (nome: string) =>
    new Set(
      normalizar(nome)
        .split(" ")
        .filter((p) => p && !ignorar.has(p)),
    );

  const x = palavras(a);
  const y = palavras(b);

  if (!x.size || !y.size) return false;

  const comuns = [...x].filter((p) => y.has(p)).length;
  const pontuacao = (2 * comuns) / (x.size + y.size);

  return comuns >= 2 && pontuacao >= 0.6;
}

function numero(valor: string): number {
  const texto = String(valor ?? "")
    .trim()
    .replace(/[^\d,.-]/g, "");

  if (!texto) return NaN;

  const convertido = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  return Number(convertido);
}

async function lerPlanilha(arquivo: File): Promise<ProdutoExcel[]> {
  if (
    !arquivo.name.toLowerCase().endsWith(".xlsx") ||
    arquivo.size > 5 * 1024 * 1024
  ) {
    throw new Error("Selecione um arquivo .xlsx de até 5 MB.");
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );

  const sheet = workbook.worksheets[0];

  if (!sheet) {
    throw new Error("Nenhuma planilha encontrada.");
  }

  const colunas = new Map<string, number>();

  sheet.getRow(1).eachCell((cell, numeroColuna) => {
    colunas.set(normalizar(cell.text), numeroColuna);
  });

  const obrigatorias = [
    "Descrição",
    "Preço Venda Varejo",
    "Ativo",
    "Quantidade em Estoque",
  ];

  for (const nome of obrigatorias) {
    if (!colunas.has(normalizar(nome))) {
      throw new Error(`Coluna não encontrada: ${nome}`);
    }
  }

  function valor(row: ExcelJS.Row, coluna: string): string {
    const posicao = colunas.get(normalizar(coluna));
    return posicao ? row.getCell(posicao).text.trim() : "";
  }

  const produtos: ProdutoExcel[] = [];

  sheet.eachRow((row, indice) => {
    if (indice === 1) return;

    const nome = valor(row, "Descrição");
    if (!nome) return;

    const preco = numero(valor(row, "Preço Venda Varejo"));
    const quantidade = numero(valor(row, "Quantidade em Estoque"));

    produtos.push({
      linha: indice,
      nome: nome.slice(0, 180),
      codigo: limparCodigo(valor(row, "Código de Barras")),
      preco,
      estoque: Number.isFinite(quantidade)
        ? Math.max(0, Math.trunc(quantidade))
        : 0,
      ativoAntigo: normalizar(valor(row, "Ativo")) === "SIM",
      categoriaAntiga: valor(row, "Categoria do Produto"),
    });
  });

  if (produtos.length === 0 || produtos.length > 2000) {
    throw new Error("A planilha deve ter de 1 a 2000 produtos.");
  }

  return produtos;
}

async function buscarProdutos(): Promise<ProdutoBanco[]> {
  const todos: ProdutoBanco[] = [];

  for (let inicio = 0; inicio < 20000; inicio += 500) {
    const { data, error } = await supabaseAdmin
      .from("produtos")
      .select("id, nome, codigo_barras")
      .order("id")
      .range(inicio, inicio + 499);

    if (error) {
      throw new Error("Falha ao consultar produtos do Supabase.");
    }

    const lote = (data ?? []) as ProdutoBanco[];
    todos.push(...lote);

    if (lote.length < 500) return todos;
  }

  throw new Error("Limite de produtos atingido.");
}

async function buscarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabaseAdmin
    .from("categorias")
    .select("id, nome, slug")
    .eq("ativo", true)
    .neq("slug", "promocoes")
    .order("nome");

  if (error) {
    throw new Error("Falha ao consultar categorias.");
  }

  return (data ?? []) as Categoria[];
}

function classificar(
  produto: ProdutoExcel,
  atuais: ProdutoBanco[],
  planilha: ProdutoExcel[],
): { situacao: Situacao; motivo: string } {
  if (!produto.ativoAntigo) {
    return {
      situacao: "ignorar",
      motivo: "Produto inativo no sistema antigo",
    };
  }

  if (
    !normalizar(produto.nome) ||
    !Number.isFinite(produto.preco) ||
    produto.preco <= 0
  ) {
    return {
      situacao: "ignorar",
      motivo: "Nome ou preço inválido",
    };
  }

  const mesmoCodigo = atuais.find((p) =>
    codigoIgual(produto.codigo, p.codigo_barras ?? ""),
  );

  if (mesmoCodigo) {
    return {
      situacao: "existente",
      motivo: `Código já cadastrado: ${mesmoCodigo.nome}`,
    };
  }

  const mesmoNome = atuais.find(
    (p) => normalizar(p.nome) === normalizar(produto.nome),
  );

  if (mesmoNome) {
    return {
      situacao: "existente",
      motivo: `Nome já cadastrado: ${mesmoNome.nome}`,
    };
  }

  const repetido = planilha.some(
    (p) =>
      p.linha !== produto.linha &&
      (normalizar(p.nome) === normalizar(produto.nome) ||
        codigoIgual(p.codigo, produto.codigo)),
  );

  if (repetido) {
    return {
      situacao: "revisar",
      motivo: "Produto repetido na própria planilha",
    };
  }

  const semelhante = atuais.find((p) => parecido(produto.nome, p.nome));

  if (semelhante) {
    return {
      situacao: "revisar",
      motivo: `Possível duplicidade: ${semelhante.nome}`,
    };
  }

  if (
    /\b(PACK|CAIXA|FARDO|COMBO|KIT|PROMOCAO)\b/.test(normalizar(produto.nome))
  ) {
    return {
      situacao: "revisar",
      motivo: "Conferir se utiliza estoque compartilhado",
    };
  }

  return {
    situacao: "novo",
    motivo: "Não encontrado no cadastro atual",
  };
}

function tratarErro(error: unknown) {
  console.error("Importação:", error);

  return NextResponse.json(
    {
      erro:
        error instanceof Error
          ? error.message
          : "Erro ao processar a planilha.",
    },
    { status: 400 },
  );
}

async function lerArquivoDaRequisicao(request: Request) {
  const form = await request.formData();
  const arquivo = form.get("arquivo");

  if (!(arquivo instanceof File)) {
    throw new Error("Selecione o arquivo Excel.");
  }

  return { form, arquivo };
}

// Apenas analisa. Não cadastra, exclui ou altera produtos.
export async function POST(request: Request) {
  if (!(await verificarAdmin())) {
    return NextResponse.json(
      { erro: "Acesso não autorizado." },
      { status: 401 },
    );
  }

  try {
    const { arquivo } = await lerArquivoDaRequisicao(request);

    const [planilha, atuais, categorias] = await Promise.all([
      lerPlanilha(arquivo),
      buscarProdutos(),
      buscarCategorias(),
    ]);

    const linhas = planilha.map((produto) => {
      const resultado = classificar(produto, atuais, planilha);

      const categoria = categorias.find(
        (c) =>
          produto.categoriaAntiga &&
          normalizar(c.nome) === normalizar(produto.categoriaAntiga),
      );

      return {
        ...produto,
        ...resultado,
        categoriaId: categoria?.id ?? 0,
      };
    });

    return NextResponse.json({ linhas, categorias });
  } catch (error) {
    return tratarErro(error);
  }
}

// Somente cadastra produtos novos escolhidos pelo administrador.
export async function PUT(request: Request) {
  if (!(await verificarAdmin())) {
    return NextResponse.json(
      { erro: "Acesso não autorizado." },
      { status: 401 },
    );
  }

  try {
    const { arquivo, form } = await lerArquivoDaRequisicao(request);

    const selecao = JSON.parse(String(form.get("selecao") ?? "[]")) as Array<{
      linha: number;
      categoriaId: number;
    }>;

    if (!Array.isArray(selecao) || selecao.length < 1 || selecao.length > 10) {
      throw new Error("Selecione de 1 a 10 produtos por lote.");
    }

    const [planilha, atuais, categorias] = await Promise.all([
      lerPlanilha(arquivo),
      buscarProdutos(),
      buscarCategorias(),
    ]);

    const resultados: Array<{
      linha: number;
      status: "importado" | "ignorado" | "erro";
      motivo: string;
    }> = [];

    const vistos = new Set<number>();

    for (const item of selecao) {
      const linha = Number(item.linha);
      const categoriaId = Number(item.categoriaId);

      if (vistos.has(linha)) continue;
      vistos.add(linha);

      const produto = planilha.find((p) => p.linha === linha);

      if (!produto) {
        resultados.push({
          linha,
          status: "erro",
          motivo: "Linha não encontrada na planilha",
        });
        continue;
      }

      if (!categorias.some((c) => c.id === categoriaId)) {
        resultados.push({
          linha,
          status: "erro",
          motivo: "Categoria inválida",
        });
        continue;
      }

      // Confere novamente antes de cada cadastro.
      const analise = classificar(produto, atuais, planilha);

      if (analise.situacao !== "novo") {
        resultados.push({
          linha,
          status: "ignorado",
          motivo: analise.motivo,
        });
        continue;
      }

      // Reutiliza a função oficial de cadastro do sistema.
      const { data, error } = await supabaseAdmin.rpc(
        "cadastrar_produto_admin",
        {
          p_codigo_barras: produto.codigo,
          p_categoria_id: categoriaId,
          p_nome: produto.nome,
          p_descricao: "Importado do PDV anterior.",
          p_preco: produto.preco,
          p_preco_promocional: null,
          p_estoque_inicial: 0,
          p_estoque_minimo: 0,
          p_imagem_url: null,
          p_ativo: false,
          p_em_promocao: false,
          p_permite_abaixo_minimo: false,
        },
      );

      if (error) {
        console.error("Erro ao cadastrar:", produto.nome, error);

        resultados.push({
          linha,
          status: "erro",
          motivo: "Não foi possível cadastrar no Supabase",
        });
        continue;
      }

      const cadastrado = Array.isArray(data) ? data[0] : data;

      if (!cadastrado?.id) {
        resultados.push({
          linha,
          status: "erro",
          motivo: "Cadastro sem confirmação; conferir no Supabase",
        });
        continue;
      }

      // Impede duplicar produtos dentro do mesmo lote.
      atuais.push({
        id: Number(cadastrado.id),
        nome: produto.nome,
        codigo_barras: produto.codigo || null,
      });

      resultados.push({
        linha,
        status: "importado",
        motivo: "Produto cadastrado com sucesso",
      });
    }

    return NextResponse.json({ resultados });
  } catch (error) {
    return tratarErro(error);
  }
}

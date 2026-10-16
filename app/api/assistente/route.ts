import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Produto = {
  nome: string;
  preco: number;
  preco_promocional: number | null;
  em_promocao: boolean;
  estoque: number;
};

const SITE = "https://deposito-do-ze.vercel.app";

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const ignorar = new Set([
  "qual",
  "quanto",
  "custa",
  "preco",
  "valor",
  "tem",
  "voce",
  "voces",
  "quero",
  "queria",
  "uma",
  "umas",
  "uns",
  "pra",
  "para",
  "com",
  "dos",
  "das",
  "esse",
  "essa",
  "estoque",
  "disponivel",
  "unidade",
  "unidades",
  "favor",
  "pode",
  "saber",
  "me",
  "ver",
  "produto",
  "produtos",
  "gelada",
  "gelado",
]);

function termos(texto: string) {
  return normalizar(texto)
    .split(" ")
    .filter((termo) => termo.length >= 3 && !ignorar.has(termo));
}

function responder(texto: string, assunto: string) {
  return {
    resposta: texto,
    assunto,
  };
}

export async function POST(request: Request) {
  try {
    const corpo = await request.text();

    if (corpo.length > 3000) {
      return NextResponse.json(
        { erro: "Mensagem muito longa." },
        { status: 400 },
      );
    }

    const dados = JSON.parse(corpo) as {
      mensagem?: unknown;
      assunto?: unknown;
    };

    if (
      typeof dados.mensagem !== "string" ||
      !dados.mensagem.trim() ||
      dados.mensagem.length > 300
    ) {
      return NextResponse.json({ erro: "Mensagem inválida." }, { status: 400 });
    }

    const mensagem = normalizar(dados.mensagem);
    const assunto =
      typeof dados.assunto === "string" ? dados.assunto.slice(0, 100) : "";

    let resultado;

    if (
      /\b(atendente|humano|pessoa)\b/.test(mensagem) ||
      mensagem.includes("falar com alguem")
    ) {
      resultado = responder(
        "Claro! 😊 Você pode falar diretamente com nossa equipe pelo WhatsApp. Use o botão de atendimento humano aqui no chat.",
        "",
      );
    } else if (/\b(horario|abre|fecha|funcionamento)\b/.test(mensagem)) {
      resultado = responder(
        "Para confirmar o horário de funcionamento de hoje, fale com nossa equipe pelo WhatsApp. 😊",
        "",
      );
    } else if (/\b(endereco|localizacao|onde fica)\b/.test(mensagem)) {
      resultado = responder(
        "Estamos na Avenida Recife, 574, Jardim Pernambuco, Nova Iguaçu - RJ. 📍",
        "",
      );
    } else if (/\b(entrega|delivery|frete|bairro|uber)\b/.test(mensagem)) {
      resultado = responder(
        "🛵 Atendemos Jardim Pernambuco e Jardim Nova Era com entrega gratuita. Para outros bairros, consulte o envio via Uber Flash com nossa equipe. O CEP será validado no checkout.",
        "",
      );
    } else if (/\b(pix|pagamento|cartao|dinheiro|troco)\b/.test(mensagem)) {
      resultado = responder(
        "Aceitamos Pix, dinheiro e cartão na entrega. 💳 O cartão na entrega tem taxa de R$ 2,00. Pagamentos são confirmados somente pelo sistema ou pela equipe.",
        "",
      );
    } else if (
      /\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(mensagem) &&
      mensagem.split(" ").length <= 3
    ) {
      resultado = responder(
        "Olá! 😊 Seja bem-vindo ao Depósito do Zé! Posso ajudar com preços, produtos, disponibilidade, entrega e pagamentos. O que você gostaria de saber?",
        "",
      );
    } else {
      const { data, error } = await supabaseAdmin
        .from("produtos")
        .select("nome, preco, preco_promocional, em_promocao, estoque")
        .eq("ativo", true)
        .order("nome")
        .limit(300);

      if (error) {
        throw new Error("Falha ao consultar catálogo");
      }

      const produtos = (data ?? []) as Produto[];

      let palavras = termos(dados.mensagem);

      // Mantém o assunto em perguntas de continuação.
      if (
        palavras.length === 0 &&
        assunto &&
        /\b(mais|quantas|quantos|tem|preco)\b/.test(mensagem)
      ) {
        palavras = termos(assunto);
      }

      const encontrados = produtos
        .map((produto) => {
          const nome = normalizar(produto.nome);
          const palavrasNome = nome.split(" ");

          const pontos = palavras.reduce((total, palavra) => {
            if (palavrasNome.includes(palavra)) {
              return total + 3;
            }

            if (
              palavrasNome.some(
                (parte) =>
                  parte.startsWith(palavra) || palavra.startsWith(parte),
              )
            ) {
              return total + 1;
            }

            return total;
          }, 0);

          return { produto, pontos };
        })
        .filter((item) => item.pontos > 0)
        .sort((a, b) => b.pontos - a.pontos)
        .slice(0, 5);

      if (encontrados.length === 0) {
        resultado = responder(
          "Posso consultar os preços e a disponibilidade dos nossos produtos. 😊 Experimente perguntar pelo nome da bebida ou escreva ENTREGA, PAGAMENTO ou ATENDENTE.",
          "",
        );
      } else {
        const linhas = encontrados.map(({ produto }) => {
          const preco =
            produto.em_promocao && produto.preco_promocional !== null
              ? Number(produto.preco_promocional)
              : Number(produto.preco);

          const disponibilidade =
            Number(produto.estoque) > 0
              ? "Disponível no momento"
              : "Indisponível no momento";

          return `• ${produto.nome}: ${moeda(preco)} — ${disponibilidade}`;
        });

        resultado = responder(
          "Encontrei estas opções no catálogo: 🍻\n\n" +
            linhas.join("\n") +
            "\n\nOs valores e estoques podem mudar até a finalização. Confira no site:\n" +
            SITE +
            "\n\nPosso ajudar em mais alguma coisa?",
          encontrados[0].produto.nome,
        );
      }
    }

    return NextResponse.json(resultado, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Erro no assistente:", error);

    return NextResponse.json(
      {
        erro: "Atendimento temporariamente indisponível.",
      },
      { status: 500 },
    );
  }
}

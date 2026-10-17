"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";

type Aba = "pedido" | "duvidas";

type Mensagem = {
  autor: "cliente" | "assistente";
  texto: string;
};

const WHATSAPP = "https://wa.me/5521973209746";

function identificarPedidoDeCompra(mensagem: string) {
  const texto = mensagem
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!texto) return false;

  // Perguntas sobre precos ou informacoes
  // permanecem na aba Tirar duvidas.
  const perguntaInformativa =
    /^(qual|quais|quanto|tem|voce tem|voces tem|quero saber|queria saber|gostaria de saber|como funciona)\b/.test(texto) ||
    /\b(preco|precos|valor|valores|custa|custam|disponibilidade|horario|endereco|localizacao)\b/.test(texto);

  if (perguntaInformativa) {
    return false;
  }

  // Formas naturais de solicitar compras.
  const intencaoExplicita =
    /\b(quero|queria|querer|gostaria|manda|mande|mandar|coloca|coloque|adiciona|adicione|adicionar|preciso|pedir|comprar|separa|separe|traz|envia|envie)\b/.test(texto);

  const quantidade =
    /\b([1-9]\d?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\b/.test(texto);

  const mencionaProduto =
    /\b(brahma|coca|cola|guarana|agua|heineken|skol|amstel|antarctica|cerveja|latao|latinha|lata|garrafa|pepsi|fanta|energetico|red|bull|imperio|original|budweiser|corona|vinho|vodka|whisky|carvao|gelo|suco|pack|fardo|combo|sprite|soda|refrigerante)\b/.test(texto);

  // Exemplo: "2 brahmas latao e duas coca 2l".
  const comecaComQuantidade =
    /^(?:[1-9]\d?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s/.test(texto);

  return (
    (intencaoExplicita && (quantidade || mencionaProduto)) ||
    (comecaComQuantidade && mencionaProduto)
  );
}

export default function PedidoFacilWidget() {
  const pathname = usePathname();

  const [aberto, setAberto] = useState(true);
  const [minimizado, setMinimizado] = useState(false);
  const [aba, setAba] = useState<Aba>("pedido");

  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [assunto, setAssunto] = useState("");

  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      autor: "assistente",
      texto:
        "Olá! 👋 Sou o assistente virtual do Depósito do Zé.\n\n" +
        "Posso consultar preços, produtos, disponibilidade, " +
        "entregas e pagamentos.\n\n" +
        "O que você gostaria de saber?",
    },
  ]);

  const fimMensagens = useRef<HTMLDivElement>(null);
  const enviandoRef = useRef(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeProntoRef = useRef(false);
  const pedidoPendenteRef = useRef<string | null>(null);

  function transferirPedido(mensagem: string) {
    pedidoPendenteRef.current = mensagem;

    if (iframeProntoRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { tipo: "deposito-ze-iniciar-pedido", mensagem },
        window.location.origin,
      );
      pedidoPendenteRef.current = null;
    }
  }

  useEffect(() => {
    function receberConfirmacao(evento: MessageEvent) {
      if (
        evento.origin !== window.location.origin ||
        evento.source !== iframeRef.current?.contentWindow ||
        evento.data?.tipo !== "deposito-ze-pedido-pronto"
      ) {
        return;
      }

      iframeProntoRef.current = true;

      const mensagem = pedidoPendenteRef.current;

      if (mensagem && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { tipo: "deposito-ze-iniciar-pedido", mensagem },
          window.location.origin,
        );
        pedidoPendenteRef.current = null;
      }
    }

    window.addEventListener("message", receberConfirmacao);

    return () => {
      window.removeEventListener("message", receberConfirmacao);
    };
  }, []);

  useEffect(() => {
    if (!aberto || minimizado) {
      iframeProntoRef.current = false;
    }
  }, [aberto, minimizado]);

  useEffect(() => {
    if (aba === "duvidas" && aberto && !minimizado) {
      fimMensagens.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [mensagens, aba, aberto, minimizado]);

  async function enviarMensagem(mensagem: string) {
    const pergunta = mensagem.trim();

    if (!pergunta || enviandoRef.current) {
      return;
    }

    enviandoRef.current = true;
    setCarregando(true);
    setTexto("");

    setMensagens((anteriores) => [
      ...anteriores,
      {
        autor: "cliente",
        texto: pergunta,
      },
    ]);

    if (identificarPedidoDeCompra(pergunta)) {
      try {
        const consulta = await fetch("/api/pedido-facil/interpretar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem: pergunta }),
          cache: "no-store",
        });

        const dados = (await consulta.json()) as {
          sucesso?: boolean;
          erro?: string;
          itens?: {
            nome: string;
            quantidade: number;
            subtotal: number;
          }[];
          duvidas?: { trecho: string }[];
          nao_encontrados?: { trecho: string }[];
        };

        if (!consulta.ok || dados.sucesso !== true) {
          throw new Error(
            dados.erro || "Nao foi possivel interpretar o pedido."
          );
        }

        const itens = dados.itens ?? [];
        const duvidas = dados.duvidas ?? [];
        const naoEncontrados = dados.nao_encontrados ?? [];

        const linhas = itens.map((item) => {
          const subtotal = Number(item.subtotal).toLocaleString(
            "pt-BR",
            { style: "currency", currency: "BRL" }
          );

          return `${item.quantidade}x ${item.nome} - ${subtotal}`;
        });

        const partes: string[] = [];

        if (linhas.length > 0) {
          partes.push("Encontrei estes produtos:\n\n" + linhas.join("\n"));
        }

        if (duvidas.length > 0) {
          partes.push(
            "Preciso confirmar algumas opcoes:\n" +
            duvidas.map((item) => item.trecho).join("\n")
          );
        }

        if (naoEncontrados.length > 0) {
          partes.push(
            "Nao encontrei:\n" +
            naoEncontrados.map((item) => item.trecho).join("\n")
          );
        }

        partes.push(
          "Vou abrir o Pedido Facil para conferir os itens. " +
          "Nenhuma compra foi finalizada ainda."
        );

        setMensagens((anteriores) => [
          ...anteriores,
          {
            autor: "assistente",
            texto: partes.join("\n\n"),
          },
        ]);

        // Abrir a aba antes de tentar transferir.
        setAba("pedido");
        transferirPedido(pergunta);
      } catch (erro) {
        setMensagens((anteriores) => [
          ...anteriores,
          {
            autor: "assistente",
            texto:
              "Nao consegui consultar os produtos: " +
              (erro instanceof Error
                ? erro.message
                : "Erro desconhecido."),
          },
        ]);
      } finally {
        enviandoRef.current = false;
        setCarregando(false);
      }

      return;
    }
    try {
      const resposta = await fetch("/api/assistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mensagem: pergunta,
          assunto,
        }),
        cache: "no-store",
      });

      if (!resposta.ok) {
        throw new Error("Falha ao consultar assistente");
      }

      const dados = (await resposta.json()) as {
        resposta?: string;
        assunto?: string;
      };

      if (!dados.resposta) {
        throw new Error("Resposta vazia");
      }

      setAssunto(dados.assunto ?? "");

      setMensagens((anteriores) => [
        ...anteriores,
        {
          autor: "assistente",
          texto: dados.resposta!,
        },
      ]);
    } catch {
      setMensagens((anteriores) => [
        ...anteriores,
        {
          autor: "assistente",
          texto:
            "Desculpe! Não consegui consultar as " +
            "informações agora. 😕\n\n" +
            "Você pode tentar novamente ou falar " +
            "diretamente com nossa equipe pelo WhatsApp.",
        },
      ]);
    } finally {
      enviandoRef.current = false;
      setCarregando(false);
    }
  }

  function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviarMensagem(texto);
  }

  function abrirJanela() {
    setAberto(true);
    setMinimizado(false);
  }

  // Não interfere nas telas administrativas ou
  // nas etapas de finalização de pedidos.
  if (
    pathname === "/pedido-facil" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/pedido/") ||
    pathname.startsWith("/checkout")
  ) {
    return null;
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={abrirJanela}
        className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-full bg-amber-400 px-5 py-4 font-black text-zinc-950 shadow-2xl transition hover:scale-105"
        aria-label="Abrir atendimento do Depósito do Zé"
      >
        <span className="text-2xl">🍺</span>
        Pedido Fácil
      </button>
    );
  }

  if (minimizado) {
    return (
      <div className="fixed bottom-5 right-5 z-[9999] w-[calc(100%-2rem)] max-w-[390px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
        <button
          type="button"
          onClick={() => setMinimizado(false)}
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-xl">
              🍺
            </div>

            <div>
              <p className="font-black text-white">Pedido Fácil</p>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <span className="text-xs text-zinc-400">
                  Atendimento disponível
                </span>
              </div>
            </div>
          </div>

          <span className="text-xl text-zinc-400">↑</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="
        fixed z-[9999] flex flex-col overflow-hidden
        border border-white/10 bg-zinc-950 shadow-2xl
        inset-x-3 bottom-3 top-3 rounded-3xl
        md:inset-auto md:bottom-5 md:right-5
        md:h-[720px] md:w-[420px]
      "
    >
      {/* CABEÇALHO */}
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 bg-zinc-950 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-400 text-xl">
            🍺
          </div>

          <div>
            <p className="font-black text-white">Pedido Fácil</p>

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />

              <span className="text-xs text-zinc-400">
                Pedidos e atendimento virtual
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMinimizado(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Minimizar"
          >
            —
          </button>

          <button
            type="button"
            onClick={() => setAberto(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-white/10 bg-zinc-950 p-2">
        <button
          type="button"
          onClick={() => setAba("pedido")}
          className={`rounded-xl px-3 py-3 text-sm font-black transition ${
            aba === "pedido"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          🛒 Fazer pedido
        </button>

        <button
          type="button"
          onClick={() => setAba("duvidas")}
          className={`rounded-xl px-3 py-3 text-sm font-black transition ${
            aba === "duvidas"
              ? "bg-amber-400 text-zinc-950"
              : "bg-zinc-900 text-zinc-400 hover:text-white"
          }`}
        >
          🤖 Tirar dúvidas
        </button>
      </div>

      {/* CONTEÚDO DAS DUAS ABAS */}
      <div className="relative min-h-0 flex-1">
        {/*
          O iframe permanece montado ao trocar de aba.
          Isso preserva o estado do Pedido Fácil.
        */}
        <iframe
          ref={iframeRef}
          onLoad={() => {
            iframeProntoRef.current = false;
            iframeRef.current?.contentWindow?.postMessage(
              { tipo: "deposito-ze-perguntar-pronto" },
              window.location.origin,
            );
          }}
          src="/pedido-facil"
          title="Faça seu pedido no Depósito do Zé"
          className={`absolute inset-0 h-full w-full border-0 bg-zinc-950 ${
            aba === "pedido" ? "block" : "hidden"
          }`}
        />

        {/* ATENDENTE INTELIGENTE */}
        <section
          className={`h-full flex-col bg-zinc-950 ${
            aba === "duvidas" ? "flex" : "hidden"
          }`}
        >
          <div className="shrink-0 border-b border-white/10 bg-amber-400/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>

              <div>
                <p className="text-sm font-black text-white">
                  Assistente do Zé
                </p>

                <p className="text-xs text-zinc-400">
                  Consultando informações da loja
                </p>
              </div>
            </div>
          </div>

          {/* HISTÓRICO */}
          <div
            className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {mensagens.map((mensagem, indice) => (
              <div
                key={indice}
                className={`rounded-2xl p-3 text-sm leading-6 ${
                  mensagem.autor === "cliente"
                    ? "ml-8 rounded-br-sm bg-amber-400 text-zinc-950"
                    : "mr-6 rounded-bl-sm bg-zinc-800 text-white"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">
                  {mensagem.texto}
                </p>
              </div>
            ))}

            {carregando && (
              <div className="mr-10 rounded-xl bg-zinc-800 p-3 text-xs text-zinc-400">
                Consultando o catálogo... ⏳
              </div>
            )}

            <div ref={fimMensagens} />
          </div>

          {/* RODAPÉ */}
          <div className="shrink-0 border-t border-white/10 bg-zinc-950 p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {["Brahma", "Entrega", "Pagamento"].map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  disabled={carregando}
                  onClick={() => void enviarMensagem(sugestao)}
                  className="rounded-full border border-amber-400/30 px-3 py-1.5 text-xs text-amber-400 transition hover:bg-amber-400/10 disabled:opacity-50"
                >
                  {sugestao}
                </button>
              ))}
            </div>

            <form onSubmit={enviarFormulario} className="flex gap-2">
              <input
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                maxLength={300}
                placeholder="Digite sua pergunta..."
                aria-label="Mensagem para o assistente"
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
              />

              <button
                type="submit"
                disabled={carregando || !texto.trim()}
                className="rounded-xl bg-amber-400 px-4 text-sm font-black text-zinc-950 disabled:opacity-50"
              >
                Enviar
              </button>
            </form>

            <button
              type="button"
              onClick={() => setAba("pedido")}
              className="mt-3 w-full rounded-lg border border-amber-400/25 py-2 text-xs font-bold text-amber-400 hover:bg-amber-400/5"
            >
              🛒 Ir para o Pedido Fácil
            </button>

            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block py-2 text-center text-xs font-bold text-emerald-400 hover:underline"
            >
              Falar com atendimento humano no WhatsApp ↗
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

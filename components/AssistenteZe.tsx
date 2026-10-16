"use client";

import { FormEvent, useState } from "react";
import { usePathname } from "next/navigation";

type Mensagem = {
  autor: "cliente" | "assistente";
  texto: string;
};

const WHATSAPP = "https://wa.me/5521973209746";

export default function AssistenteZe() {
  const [aberto, setAberto] = useState(false);
  const [digitando, setDigitando] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [assunto, setAssunto] = useState("");

  const pathname = usePathname();

  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      autor: "assistente",
      texto:
        "Olá! 👋 Sou o assistente virtual do Depósito do Zé. Posso ajudar com produtos, preços, disponibilidade e entregas. Como posso ajudar?",
    },
  ]);

  async function enviar(mensagem: string) {
    const texto = mensagem.trim();

    if (!texto || carregando) return;

    setDigitando("");
    setCarregando(true);

    setMensagens((atuais) => [...atuais, { autor: "cliente", texto }]);

    try {
      const resposta = await fetch("/api/assistente", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mensagem: texto,
          assunto,
        }),
      });

      if (!resposta.ok) {
        throw new Error("Falha na resposta");
      }

      const dados = (await resposta.json()) as {
        resposta: string;
        assunto: string;
      };

      setAssunto(dados.assunto || "");

      setMensagens((atuais) => [
        ...atuais,
        {
          autor: "assistente",
          texto: dados.resposta,
        },
      ]);
    } catch {
      setMensagens((atuais) => [
        ...atuais,
        {
          autor: "assistente",
          texto:
            "Desculpe, estou com dificuldade para consultar as informações agora. Você pode falar com nossa equipe pelo WhatsApp.",
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void enviar(digitando);
  }

  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/checkout") ||
    pathname?.startsWith("/pedido/")
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-[100]">
      {aberto && (
        <section className="mb-3 flex h-[min(580px,80vh)] w-[min(390px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-white shadow-2xl">
          <header className="flex items-center justify-between bg-amber-400 px-4 py-4 text-zinc-950">
            <div>
              <h2 className="font-black">🤖 Assistente do Zé</h2>
              <p className="text-xs">Atendimento virtual da loja</p>
            </div>

            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg bg-black/10 px-3 py-2 font-bold"
              aria-label="Fechar chat"
            >
              ✕
            </button>
          </header>

          <div
            className="flex-1 space-y-3 overflow-y-auto p-4"
            aria-live="polite"
          >
            {mensagens.map((mensagem, indice) => (
              <div
                key={indice}
                className={
                  mensagem.autor === "cliente"
                    ? "ml-8 rounded-2xl rounded-br-sm bg-amber-400 p-3 text-sm text-zinc-950"
                    : "mr-8 rounded-2xl rounded-bl-sm bg-zinc-800 p-3 text-sm text-white"
                }
              >
                <p className="whitespace-pre-wrap leading-6">
                  {mensagem.texto}
                </p>
              </div>
            ))}

            {carregando && (
              <p className="text-xs text-zinc-400">
                Consultando informações...
              </p>
            )}
          </div>

          <div className="border-t border-zinc-800 p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {["Brahma", "Entrega", "Pagamento"].map((sugestao) => (
                <button
                  key={sugestao}
                  type="button"
                  onClick={() => void enviar(sugestao)}
                  disabled={carregando}
                  className="rounded-full border border-amber-400/30 px-3 py-1.5 text-xs text-amber-400 disabled:opacity-50"
                >
                  {sugestao}
                </button>
              ))}
            </div>

            <form onSubmit={aoEnviar} className="flex gap-2">
              <input
                value={digitando}
                onChange={(evento) => setDigitando(evento.target.value)}
                maxLength={300}
                placeholder="Digite sua pergunta..."
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
                aria-label="Sua mensagem"
              />

              <button
                type="submit"
                disabled={carregando || !digitando.trim()}
                className="rounded-xl bg-amber-400 px-4 font-black text-zinc-950 disabled:opacity-50"
              >
                Enviar
              </button>
            </form>

            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block text-center text-xs font-bold text-emerald-400 hover:underline"
            >
              Falar com atendimento humano no WhatsApp ↗
            </a>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="ml-auto flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 px-5 py-4 font-black text-zinc-950 shadow-2xl transition hover:bg-amber-300"
      >
        <span className="text-xl">🤖</span>
        {aberto ? "Fechar chat" : "Falar com o Zé"}
      </button>
    </div>
  );
}

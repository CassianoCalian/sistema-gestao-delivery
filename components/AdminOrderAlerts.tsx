"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  ultimoPedidoId: number;
  atualizarPagina?: boolean;
  embutido?: boolean;
};

type PedidoMonitorado = {
  id: number;
  status: string;
};

const CHAVE_MARCADOR = "deposito-ze:admin:ultimo-pedido-observado:v1";

const INTERVALO = 8000;

export default function AdminOrderAlerts({
  ultimoPedidoId,
  atualizarPagina = true,
  embutido = false,
}: Props) {
  const router = useRouter();

  const inicialRef = useRef(ultimoPedidoId);
  const marcadorRef = useRef(ultimoPedidoId);
  const somRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  const [somHabilitado, setSomHabilitado] = useState(false);

  const [novosIds, setNovosIds] = useState<number[]>([]);
  const [falha, setFalha] = useState(false);

  const tocarAviso = useCallback(() => {
    const contexto = audioRef.current;

    if (!somRef.current || !contexto || contexto.state !== "running") {
      return;
    }

    const agora = contexto.currentTime;

    [0, 0.25].forEach((atraso) => {
      const oscilador = contexto.createOscillator();
      const ganho = contexto.createGain();

      oscilador.type = "sine";
      oscilador.frequency.value = 880;

      ganho.gain.setValueAtTime(0.0001, agora + atraso);

      ganho.gain.exponentialRampToValueAtTime(0.13, agora + atraso + 0.02);

      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.18);

      oscilador.connect(ganho);
      ganho.connect(contexto.destination);

      oscilador.start(agora + atraso);
      oscilador.stop(agora + atraso + 0.2);
    });
  }, []);

  async function ativarSom() {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }

      await audioRef.current.resume();

      somRef.current = true;
      setSomHabilitado(true);

      // Toca um aviso de teste.
      tocarAviso();
    } catch {
      setFalha(true);
    }
  }

  function desativarSom() {
    somRef.current = false;
    setSomHabilitado(false);
  }

  useEffect(() => {
    let ativo = true;
    let consultando = false;
    let ciclos = 0;

    // Recupera o último pedido observado.
    // Evita avisos repetidos após atualizar a página.
    try {
      const salvo = window.localStorage.getItem(CHAVE_MARCADOR);

      const numero = salvo === null ? NaN : Number(salvo);

      const valido = Number.isSafeInteger(numero) && numero >= 0;

      marcadorRef.current = valido
        ? Math.max(numero, inicialRef.current)
        : inicialRef.current;

      window.localStorage.setItem(CHAVE_MARCADOR, String(marcadorRef.current));
    } catch {
      marcadorRef.current = inicialRef.current;
    }

    async function consultar() {
      if (!ativo || consultando) return;

      consultando = true;

      try {
        const resposta = await fetch(
          `/api/admin/pedidos/alertas?depois=${marcadorRef.current}`,
          {
            cache: "no-store",
          },
        );

        if (!resposta.ok) {
          throw new Error(`Falha na consulta: ${resposta.status}`);
        }

        const resultado = (await resposta.json()) as {
          pedidos?: PedidoMonitorado[];
        };

        const pedidos = Array.isArray(resultado.pedidos)
          ? resultado.pedidos
          : [];

        const idsNovos = pedidos
          .filter(
            (pedido) =>
              Number.isSafeInteger(pedido.id) &&
              pedido.id > marcadorRef.current &&
              pedido.status === "recebido",
          )
          .map((pedido) => pedido.id);

        const ultimo = pedidos.reduce(
          (maior, pedido) =>
            Number.isSafeInteger(pedido.id)
              ? Math.max(maior, pedido.id)
              : maior,
          marcadorRef.current,
        );

        if (ultimo > marcadorRef.current) {
          marcadorRef.current = ultimo;

          try {
            window.localStorage.setItem(CHAVE_MARCADOR, String(ultimo));
          } catch {
            // Armazenamento indisponível.
          }
        }

        if (!ativo) return;

        setFalha(false);

        if (idsNovos.length > 0) {
          setNovosIds((atuais) =>
            [...new Set([...atuais, ...idsNovos])].slice(-30),
          );

          tocarAviso();
        }

        ciclos += 1;

        // Atualiza a lista e os indicadores.
        if (atualizarPagina && (pedidos.length > 0 || ciclos % 3 === 0)) {
          router.refresh();
        }
      } catch (error) {
        if (ativo) {
          console.error("Monitor de pedidos indisponível:", error);

          setFalha(true);
        }
      } finally {
        consultando = false;
      }
    }

    void consultar();

    const intervalo = window.setInterval(() => void consultar(), INTERVALO);

    const aoVoltar = () => {
      if (!document.hidden) {
        void consultar();
      }
    };

    window.addEventListener("focus", aoVoltar);

    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      ativo = false;

      window.clearInterval(intervalo);

      window.removeEventListener("focus", aoVoltar);

      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router, tocarAviso, atualizarPagina]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        void audioRef.current.close();
      }
    };
  }, []);

  return (
    <aside
      className={
        embutido
          ? "relative z-10 mb-3 ml-auto w-full max-w-sm"
          : "fixed bottom-4 right-4 z-[90] w-[calc(100%-2rem)] max-w-sm"
      }
      aria-live="polite"
    >
      {novosIds.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber-400/40 bg-zinc-950 p-4 text-white shadow-2xl">
          <p className="text-base font-black text-amber-400">
            🔔 Novo pedido recebido!
          </p>

          <p className="mt-2 text-sm text-zinc-200">
            {novosIds.length}{" "}
            {novosIds.length === 1 ? "pedido novo" : "pedidos novos"} aguardando
            atenção.
          </p>

          <p className="mt-2 text-xs text-zinc-400">
            {novosIds
              .slice(-5)
              .map((id) => `#${id}`)
              .join(", ")}
          </p>

          <div className="mt-4 flex gap-2">
            <Link
              href="/admin/pedidos?status=recebido"
              className="flex-1 rounded-xl bg-amber-400 px-3 py-2 text-center text-sm font-bold text-zinc-950"
            >
              Ver pedidos
            </Link>

            <button
              type="button"
              onClick={() => setNovosIds([])}
              className="rounded-xl border border-white/20 px-3 py-2 text-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-zinc-900 px-4 py-3 text-white shadow-xl">
        <span className="text-xs font-semibold">
          {falha
            ? "⚠️ Verifique a conexão do monitor"
            : "● Monitor de pedidos ativo"}
        </span>

        <button
          type="button"
          onClick={somHabilitado ? desativarSom : () => void ativarSom()}
          className="shrink-0 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-zinc-950"
        >
          {somHabilitado ? "🔊 Som ligado" : "🔇 Ativar som"}
        </button>
      </div>
    </aside>
  );
}

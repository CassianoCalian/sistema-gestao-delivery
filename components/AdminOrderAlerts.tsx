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
  forma_pagamento: string;
  pagamento_confirmado: boolean | null;
};

const CHAVE_MARCADOR = "deposito-ze:admin:ultimo-pedido-observado:v1";

const INTERVALO = 8000;
const INTERVALO_LEMBRETE = 90_000;

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
  const aguardandoAnteriorRef = useRef<number[] | null>(null);
  const ultimoLembreteRef = useRef(0);

  const [somHabilitado, setSomHabilitado] = useState(false);

  const [novosIds, setNovosIds] = useState<number[]>([]);
  const [falha, setFalha] = useState(false);

  const [atrasados, setAtrasados] = useState<number[]>([]);
  const [aguardando, setAguardando] = useState<number[]>([]);

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
      ultimoLembreteRef.current = Date.now();

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
          atrasados?: number[];
          aguardando?: number[];
        };

        const pedidos = Array.isArray(resultado.pedidos)
          ? resultado.pedidos
          : [];

        const idsNovos = pedidos
          .filter(
            (pedido) =>
              Number.isSafeInteger(pedido.id) &&
              pedido.id > marcadorRef.current &&
              pedido.status === "recebido" &&
              (pedido.forma_pagamento !== "pix" ||
                pedido.pagamento_confirmado === true),
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

        const idsAguardando = Array.isArray(resultado.aguardando)
          ? resultado.aguardando.filter(
              (id) => Number.isSafeInteger(id) && id > 0,
            )
          : [];

        const idsAtrasados = Array.isArray(resultado.atrasados)
          ? resultado.atrasados.filter(
              (id) => Number.isSafeInteger(id) && id > 0,
            )
          : [];

        const conhecidos = aguardandoAnteriorRef.current;

        const surgiuPendente =
          conhecidos !== null &&
          idsAguardando.some((id) => !conhecidos.includes(id));

        aguardandoAnteriorRef.current = idsAguardando;

        setAguardando(idsAguardando);
        setAtrasados(idsAtrasados);

        setNovosIds((atuais) => {
          const restantes = atuais.filter((id) =>
            idsAguardando.includes(id),
          );

          return restantes.length === atuais.length
            ? atuais
            : restantes;
        });

        if (idsAtrasados.length === 0) {
          ultimoLembreteRef.current = 0;
        }

        const agora = Date.now();

        const lembrarAtrasados =
          somRef.current &&
          idsAtrasados.length > 0 &&
          agora - ultimoLembreteRef.current >= INTERVALO_LEMBRETE;

        if (lembrarAtrasados) {
          ultimoLembreteRef.current = agora;
        }

        if (idsNovos.length > 0 || surgiuPendente || lembrarAtrasados) {
          tocarAviso();
        }

        if (idsNovos.length > 0) {
          setNovosIds((atuais) =>
            [...new Set([...atuais, ...idsNovos])].slice(-30),
          );

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
      {aguardando.length > 0 &&
        atrasados.length === 0 &&
        novosIds.length === 0 && (
          <div className="mb-3 rounded-xl border border-amber-400/40 bg-zinc-950 p-4 text-white shadow-xl">
            <p className="text-sm font-black text-amber-300">
              {aguardando.length} pedido(s) aguardando atendimento
            </p>

            <Link
              href="/admin/pedidos?status=recebido"
              className="mt-3 block rounded-lg bg-amber-400 px-3 py-2 text-center text-xs font-black text-zinc-950"
            >
              Ver pedidos recebidos
            </Link>
          </div>
        )}

      {atrasados.length > 0 && (
        <div className="mb-3 rounded-xl border border-orange-400/40 bg-zinc-950 p-4 text-white shadow-xl">
          <p className="text-sm font-black text-orange-400">
            ⚠️ Pedidos aguardando há mais de 5 minutos
          </p>

          <p className="mt-2 text-sm text-zinc-300">
            {atrasados.length}{" "}
            {atrasados.length === 1 ? "pedido precisa" : "pedidos precisam"} de
            atenção.
          </p>

          <p className="mt-2 text-xs text-zinc-400">
            {atrasados
              .slice(0, 5)
              .map((id) => `#${id}`)
              .join(", ")}
          </p>

          <Link
            href="/admin/pedidos?status=recebido"
            className="mt-3 block rounded-lg bg-orange-400 px-3 py-2 text-center text-xs font-black text-zinc-950"
          >
            Ver pedidos aguardando
          </Link>
        </div>
      )}

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
            : aguardando.length > 0
              ? `● Monitor ativo • ${aguardando.length} aguardando`
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

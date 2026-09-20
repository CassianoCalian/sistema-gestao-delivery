"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AdminAutoRefreshProps = {
  ultimoPedidoId: number;
};
const ALERTAS_STORAGE_KEY = "deposito-ze-alertas-ativos";

export default function AdminAutoRefresh({
  ultimoPedidoId,
}: AdminAutoRefreshProps) {
  const router = useRouter();

  const [alertasAtivos, setAlertasAtivos] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  function obterAudioContext() {
    const janela = window as Window & {
      depositoZeAudioContext?: AudioContext;
    };

    if (!janela.depositoZeAudioContext) {
      janela.depositoZeAudioContext = new AudioContext();
    }

    audioContextRef.current = janela.depositoZeAudioContext;

    return janela.depositoZeAudioContext;
  }

  const ultimoConhecidoRef = useRef(ultimoPedidoId);

  useEffect(() => {
    ultimoConhecidoRef.current = ultimoPedidoId;
  }, [ultimoPedidoId]);

  useEffect(() => {
    const alertasSalvos =
      window.localStorage.getItem(ALERTAS_STORAGE_KEY) === "true";

    if (!alertasSalvos) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setAlertasAtivos(true);
    });

    const janela = window as Window & {
      depositoZeAudioContext?: AudioContext;
    };

    if (janela.depositoZeAudioContext) {
      audioContextRef.current = janela.depositoZeAudioContext;
    }

    async function desbloquearAudio() {
      try {
        const audioContext = obterAudioContext();

        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Não foi possível reativar o áudio:", error);
        }
      }
    }

    if (
      !janela.depositoZeAudioContext ||
      janela.depositoZeAudioContext.state === "suspended"
    ) {
      window.addEventListener("pointerdown", desbloquearAudio, {
        once: true,
      });

      window.addEventListener("keydown", desbloquearAudio, {
        once: true,
      });
    }

    return () => {
      window.cancelAnimationFrame(frame);

      window.removeEventListener("pointerdown", desbloquearAudio);
      window.removeEventListener("keydown", desbloquearAudio);
    };
  }, []);

  async function ativarAlertas() {
    try {
      const audioContext = obterAudioContext();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      window.localStorage.setItem(ALERTAS_STORAGE_KEY, "true");

      setAlertasAtivos(true);

      // Teste imediato do som
      tocarAlerta();

      // Teste imediato da notificação
      if ("Notification" in window) {
        let permissao = Notification.permission;

        if (permissao === "default") {
          permissao = await Notification.requestPermission();
        }

        if (permissao === "granted") {
          new Notification("Depósito do Zé", {
            body: "🔔 Alertas de novos pedidos ativados!",
          });
        }

        if (permissao === "denied") {
          alert(
            "As notificações estão bloqueadas pelo navegador. Vamos liberar nas configurações.",
          );
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        if (process.env.NODE_ENV === "development") {
          console.error("Erro ao verificar novos pedidos:", error);
        }
      }
      alert("Não foi possível ativar os alertas.");
    }
  }

  function tocarAlerta() {
    const audioContext = audioContextRef.current;

    if (!audioContext) {
      return;
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.001, audioContext.currentTime);

    gain.gain.exponentialRampToValueAtTime(
      0.3,
      audioContext.currentTime + 0.02,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.6,
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.6);
  }

  function mostrarNotificacao(pedidoId: number) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Novo pedido - Depósito do Zé", {
        body: `O Pedido #${pedidoId} acabou de chegar!`,
      });
    }
  }

  useEffect(() => {
    let verificando = false;

    async function verificarNovoPedido() {
      if (verificando) {
        return;
      }

      verificando = true;

      try {
        const resposta = await fetch("/api/admin/pedidos/ultimo", {
          cache: "no-store",
        });

        if (!resposta.ok) {
          return;
        }

        const resultado = await resposta.json();

        const novoPedidoId = Number(resultado.ultimoPedidoId) || 0;

        if (novoPedidoId > ultimoConhecidoRef.current) {
          ultimoConhecidoRef.current = novoPedidoId;

          if (alertasAtivos) {
            tocarAlerta();
            mostrarNotificacao(novoPedidoId);
          }

          router.refresh();
        }
      } catch (error) {
        console.error("Erro ao verificar novos pedidos:", error);
      } finally {
        verificando = false;
      }
    }

    const intervalo = setInterval(verificarNovoPedido, 5000);

    function aoVoltarParaAba() {
      if (document.visibilityState === "visible") {
        verificarNovoPedido();
      }
    }

    window.addEventListener("focus", verificarNovoPedido);
    document.addEventListener("visibilitychange", aoVoltarParaAba);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener("focus", verificarNovoPedido);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
    };
  }, [router, alertasAtivos]);

  return (
    <section
      className={`group/alerta relative mb-8 overflow-hidden rounded-[26px] border p-5 shadow-[0_20px_70px_rgba(0,0,0,0.2)] transition duration-500 sm:p-6 ${
        alertasAtivos
          ? "border-emerald-400/15 bg-emerald-400/[0.035]"
          : "border-amber-400/15 bg-amber-400/[0.035]"
      }`}
    >
      {/* GLOW */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-[100px] transition duration-700 ${
          alertasAtivos
            ? "bg-emerald-400/[0.08] group-hover/alerta:bg-emerald-400/[0.12]"
            : "bg-amber-400/[0.08] group-hover/alerta:bg-amber-400/[0.13]"
        }`}
      />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        {/* INFORMAÇÕES */}
        <div className="flex items-start gap-4">
          <div
            className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border text-2xl transition duration-500 group-hover/alerta:scale-105 ${
              alertasAtivos
                ? "border-emerald-400/20 bg-emerald-400/[0.08]"
                : "border-amber-400/20 bg-amber-400/[0.08]"
            }`}
          >
            🔔
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-50 ${
                  alertasAtivos ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />

              <span
                className={`relative inline-flex h-3 w-3 rounded-full border-2 border-zinc-950 ${
                  alertasAtivos ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-[9px] font-black uppercase tracking-[0.18em] ${
                  alertasAtivos ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                Central de notificações
              </p>

              <span
                className={`rounded-full border px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${
                  alertasAtivos
                    ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
                    : "border-amber-400/15 bg-amber-400/[0.07] text-amber-300"
                }`}
              >
                {alertasAtivos ? "Ativo" : "Aguardando ativação"}
              </span>
            </div>

            <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-white">
              Alertas de novos pedidos
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
              {alertasAtivos
                ? "Som e notificações estão ativados neste navegador. Você será avisado sempre que um novo pedido chegar."
                : "Ative os alertas para receber som e notificação imediatamente quando um novo pedido entrar."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/[0.05] bg-black/20 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                  Verificação a cada 5s
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/[0.05] bg-black/20 px-3 py-1.5">
                <span className="text-[10px]">↻</span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                  Atualização automática
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/[0.05] bg-black/20 px-3 py-1.5">
                <span className="text-[10px]">🔊</span>

                <span className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-600">
                  Alerta sonoro
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BOTÃO */}
        <div className="xl:pl-6">
          <button
            type="button"
            onClick={ativarAlertas}
            disabled={alertasAtivos}
            className={`group/botao relative flex min-h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-[18px] border px-5 py-3 text-sm font-black transition duration-500 xl:min-w-[200px] ${
              alertasAtivos
                ? "cursor-default border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
                : "border-amber-300/30 bg-amber-400 text-zinc-950 shadow-[0_12px_40px_rgba(245,158,11,0.16)] hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-[0_18px_55px_rgba(245,158,11,0.22)]"
            }`}
          >
            {!alertasAtivos && (
              <div className="absolute -left-1/2 top-0 h-full w-1/3 skew-x-[-20deg] bg-white/25 transition-all duration-700 group-hover/botao:left-[120%]" />
            )}

            <span
              className={`relative flex h-7 w-7 items-center justify-center rounded-full ${
                alertasAtivos ? "bg-emerald-400/10" : "bg-zinc-950/10"
              }`}
            >
              {alertasAtivos ? "✓" : "🔔"}
            </span>

            <span className="relative">
              {alertasAtivos ? "Alertas ativados" : "Ativar alertas"}
            </span>
          </button>

          <p className="mt-2 text-center text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-700">
            {alertasAtivos
              ? "Monitoramento em execução"
              : "Requer permissão do navegador"}
          </p>
        </div>
      </div>

      {/* LINHA INFERIOR */}
      <div
        className={`absolute bottom-0 left-0 h-px w-full bg-linear-to-r from-transparent to-transparent ${
          alertasAtivos ? "via-emerald-400/50" : "via-amber-400/50"
        }`}
      />
    </section>
  );
}

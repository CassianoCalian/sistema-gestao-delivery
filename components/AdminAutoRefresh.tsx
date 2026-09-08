"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AdminAutoRefreshProps = {
  ultimoPedidoId: number;
};

export default function AdminAutoRefresh({
  ultimoPedidoId,
}: AdminAutoRefreshProps) {
  const router = useRouter();

  const [alertasAtivos, setAlertasAtivos] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);

  const ultimoConhecidoRef = useRef(ultimoPedidoId);

  useEffect(() => {
    ultimoConhecidoRef.current = ultimoPedidoId;
  }, [ultimoPedidoId]);

  async function ativarAlertas() {
    try {
      let audioContext = audioContextRef.current;

      if (!audioContext) {
        audioContext = new AudioContext();
        audioContextRef.current = audioContext;
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

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
      console.error("Erro ao ativar alertas:", error);

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
    <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-black text-white">🔔 Alertas de novos pedidos</p>

        <p className="mt-1 text-sm text-zinc-400">
          {alertasAtivos
            ? "Som e notificações estão ativados neste navegador."
            : "Ative para receber som e notificação quando entrar um novo pedido."}
        </p>
      </div>

      <button
        type="button"
        onClick={ativarAlertas}
        disabled={alertasAtivos}
        className={`shrink-0 rounded-xl px-5 py-3 text-sm font-black transition ${
          alertasAtivos
            ? "cursor-default border border-green-800 bg-green-500/10 text-green-400"
            : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
        }`}
      >
        {alertasAtivos ? "✓ Alertas ativados" : "🔔 Ativar alertas"}
      </button>
    </div>
  );
}

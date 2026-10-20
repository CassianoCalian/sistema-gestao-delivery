"use client";

import { useEffect, useRef, useState } from "react";

const CHAVE = "deposito-ze-pedido-facil-chave-idempotencia";
const REGISTRO = "deposito-ze-pedido-facil-tentativa-pendente";
const EVENTO = "deposito-ze-tentativa-atualizada";

type PedidoOriginal = {
  chave_idempotencia: string;
  itens: unknown[];
  [campo: string]: unknown;
};

type Tentativa = {
  chave: string;
  pedido: PedidoOriginal | null;
};

type Resposta = {
  encontrado?: boolean;
  codigo_acesso?: string;
  erro?: string;
};

function lerTentativa(): Tentativa | null {
  const chave = window.sessionStorage.getItem(CHAVE);

  if (!chave) return null;

  let pedido: PedidoOriginal | null = null;

  const registro = window.sessionStorage.getItem(REGISTRO);

  if (registro) {
    try {
      const dados = JSON.parse(registro) as PedidoOriginal;

      if (
        dados.chave_idempotencia === chave &&
        Array.isArray(dados.itens)
      ) {
        pedido = dados;
      }
    } catch {
      pedido = null;
    }
  }

  return { chave, pedido };
}

export default function RecuperarPedidoPendente({
  onDescartar,
}: {
  onDescartar: () => void;
}) {
  const [tentativa, setTentativa] = useState<Tentativa | null>(null);
  const [estado, setEstado] = useState<
    "inicio" | "consultando" | "nao-encontrado" | "reenviando"
  >("inicio");
  const [erro, setErro] = useState("");
  const [falhaDefinitiva, setFalhaDefinitiva] = useState(false);

  const ocupado = useRef(false);

  useEffect(() => {
    function atualizar() {
      setTentativa(lerTentativa());
      setEstado("inicio");
    }

    atualizar();

    window.addEventListener(EVENTO, atualizar);

    return () => {
      window.removeEventListener(EVENTO, atualizar);
    };
  }, []);

  async function executar(reenviar: boolean) {
    if (!tentativa || ocupado.current) return;
    if (reenviar && !tentativa.pedido) return;

    ocupado.current = true;
    setErro("");
    setFalhaDefinitiva(false);
    setEstado(reenviar ? "reenviando" : "consultando");

    try {
      const resposta = await fetch(
        reenviar
          ? "/api/pedidos"
          : "/api/pedido-facil/recuperar",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify(
            reenviar
              ? tentativa.pedido
              : { chave_idempotencia: tentativa.chave },
          ),
        },
      );

      const dados = (await resposta.json()) as Resposta;

      if (!resposta.ok) {
        if (
          reenviar &&
          (resposta.status === 400 || resposta.status === 422)
        ) {
          setFalhaDefinitiva(true);
        }

        throw new Error(
          dados.erro || "Nao foi possivel consultar o pedido.",
        );
      }

      if (dados.codigo_acesso) {
        window.sessionStorage.removeItem(CHAVE);
        window.sessionStorage.removeItem(REGISTRO);

        window.location.replace(
          `/pedido/${dados.codigo_acesso}`,
        );

        return;
      }

      if (reenviar) {
        throw new Error(
          "O servidor nao retornou o codigo do pedido.",
        );
      }

      if (dados.encontrado) {
        throw new Error(
          "Pedido localizado, mas sem codigo de acesso.",
        );
      }

      setEstado("nao-encontrado");
    } catch (falha) {
      setEstado("inicio");

      setErro(
        falha instanceof Error
          ? falha.message
          : "Nao foi possivel consultar agora.",
      );
    } finally {
      ocupado.current = false;
    }
  }

  if (!tentativa) return null;

  const carregando =
    estado === "consultando" || estado === "reenviando";

  return (
    <div className="rounded-3xl border border-amber-400/40 bg-zinc-900 p-5">
      <p className="font-black text-amber-300">
        Existe uma tentativa de pedido pendente
      </p>

      <p className="mt-2 text-sm leading-6 text-zinc-300">
        A compra pode ter sido registrada mesmo que a
        confirmacao nao tenha aparecido.
        Vamos consultar antes de tentar novamente.
      </p>

      <button
        type="button"
        disabled={carregando}
        onClick={() => void executar(false)}
        className="mt-4 h-12 w-full rounded-2xl bg-amber-400 font-black text-black disabled:opacity-40"
      >
        {carregando
          ? "Aguarde..."
          : "Verificar pedido anterior"}
      </button>

      {estado === "nao-encontrado" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-300">
            Ainda nao encontramos o pedido.
            Se voce acabou de enviar, aguarde um instante
            e consulte novamente.
          </p>

          {tentativa.pedido ? (
            <button
              type="button"
              disabled={carregando}
              onClick={() => void executar(true)}
              className="h-12 w-full rounded-2xl bg-emerald-500 font-black text-black disabled:opacity-40"
            >
              Reenviar pedido original
            </button>
          ) : (
            <p className="text-sm text-amber-300">
              Esta tentativa e anterior a atualizacao.
              Consulte a loja antes de iniciar outro pedido.
            </p>
          )}

          <p className="text-xs text-zinc-400">
            O reenvio usa os mesmos dados e a mesma chave
            da tentativa original.
          </p>
        </div>
      )}

      {falhaDefinitiva && (
        <button
          type="button"
          onClick={() => {
            window.sessionStorage.removeItem(CHAVE);
            window.sessionStorage.removeItem(REGISTRO);
            onDescartar();
            setTentativa(null);
            setFalhaDefinitiva(false);
          }}
          className="mt-4 h-12 w-full rounded-2xl border border-amber-400 text-sm font-bold text-amber-300"
        >
          Corrigir os dados do pedido
        </button>
      )}

      {erro && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300"
        >
          {erro}
        </p>
      )}
    </div>
  );
}
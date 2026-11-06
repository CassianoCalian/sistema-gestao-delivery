"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BuscaClientePdv from "../../../../../components/pdv/BuscaClientePdv";

type Endereco = {
  nome: string;
  telefone: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  referencia: string;
  observacao: string;
};

type Item = {
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

type Venda = {
  total: number;
  status: string;
  tipo_atendimento: string;
  forma_pagamento: string;
  dados_entrega: Partial<Endereco> | null;
};

const vazio: Endereco = {
  nome: "", telefone: "", cep: "", rua: "",
  numero: "", complemento: "", bairro: "",
  referencia: "", observacao: ""
};

const moeda = (n: number) =>
  Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export default function EditarVendaPdv({ id }: { id: number }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [venda, setVenda] = useState<Venda | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [tipo, setTipo] = useState<"balcao" | "delivery">("balcao");
  const [dados, setDados] = useState<Endereco>({ ...vazio });

  async function abrir() {
    setAberto(true);
    setCarregando(true);
    setErro("");

    try {
      const resp = await fetch(
        `/api/admin/pdv/vendas/editar?id=${id}`,
        { cache: "no-store" }
      );
      const body = await resp.json();

      if (!resp.ok || !body.sucesso)
        throw new Error(body.erro || "Falha ao consultar venda.");

      const v = body.venda as Venda;
      setVenda(v);
      setItens(body.itens as Item[]);
      setTipo(v.tipo_atendimento === "delivery" ? "delivery" : "balcao");
      setDados({ ...vazio, ...(v.dados_entrega || {}) });

    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na consulta.");
    } finally {
      setCarregando(false);
    }
  }

  async function salvar() {
    setOcupado(true);
    setErro("");

    try {
      const resp = await fetch("/api/admin/pdv/vendas/editar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venda_id: id,
          tipo,
          dados_entrega: tipo === "delivery" ? dados : null
        })
      });

      const body = await resp.json();

      if (!resp.ok || !body.sucesso)
        throw new Error(body.erro || "Falha ao salvar.");

      setAberto(false);
      router.refresh();

    } catch (e) {
      setErro(e instanceof Error ? e.message : "Nao foi possivel salvar.");
    } finally {
      setOcupado(false);
    }
  }

  function campo(
    chave: keyof Endereco,
    titulo: string,
    obrigatorio = false
  ) {
    return <label className="block text-xs font-bold text-zinc-300">
      {titulo}
      <input
        value={dados[chave]}
        required={obrigatorio}
        onChange={(e) =>
          setDados((antigo) => ({
            ...antigo,
            [chave]: e.target.value
          }))
        }
        className="mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-400"
      />
    </label>;
  }

  return <>
    <button
      type="button"
      onClick={() => void abrir()}
      className="mt-3 rounded-lg border border-blue-400/50 bg-blue-500/10 px-3 py-2 text-sm font-bold text-blue-200"
    >
      Editar / mudar para entrega
    </button>

    {aberto && <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar venda ${id}`}
    >
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-blue-400/30 bg-zinc-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-blue-300">
              Deposito do Ze
            </p>
            <h2 className="mt-1 text-xl font-black">
              Editar venda #{id}
            </h2>
          </div>

          <button
            type="button"
            disabled={ocupado}
            onClick={() => setAberto(false)}
            className="rounded-lg border border-white/20 px-3 py-1 text-lg"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {carregando ? (
          <p className="mt-5 text-zinc-400">Consultando venda...</p>
        ) : venda && (
          <form
            className="mt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void salvar();
            }}
          >
            <div className="rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="text-sm font-bold">
                Nota original — {moeda(venda.total)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Pagamento: {venda.forma_pagamento} · {venda.status}
              </p>

              <div className="mt-3 space-y-1 border-t border-white/10 pt-2">
                {itens.map((item, i) => (
                  <div key={i} className="flex justify-between gap-3 text-sm">
                    <span>
                      {item.quantidade}x {item.nome_produto}
                    </span>
                    <span className="shrink-0">
                      {moeda(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm font-bold">
              Qual o atendimento correto?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo("balcao")}
                className={`rounded-xl border px-3 py-3 text-sm font-black ${
                  tipo === "balcao"
                    ? "border-amber-400 bg-amber-400 text-black"
                    : "border-white/20"
                }`}
              >
                Balcao
              </button>
              <button
                type="button"
                onClick={() => setTipo("delivery")}
                className={`rounded-xl border px-3 py-3 text-sm font-black ${
                  tipo === "delivery"
                    ? "border-blue-400 bg-blue-500 text-white"
                    : "border-white/20"
                }`}
              >
                Delivery
              </button>
            </div>

            {tipo === "delivery" && (
              <div className="space-y-3 rounded-xl border border-blue-400/20 bg-blue-500/5 p-3">
                <p className="text-sm font-black text-blue-200">
                  Endereco para entrega
                </p>
                <BuscaClientePdv onSelecionar={(cliente) =>
                  setDados((atual) => ({ ...atual, ...cliente }))
                } />

                <div className="grid grid-cols-2 gap-3">
                  {campo("nome", "Nome")}
                  {campo("telefone", "Telefone")}
                </div>

                {campo("rua", "Rua", true)}

                <div className="grid grid-cols-2 gap-3">
                  {campo("numero", "Numero", true)}
                  {campo("bairro", "Bairro")}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {campo("complemento", "Complemento")}
                  {campo("cep", "CEP")}
                </div>

                {campo("referencia", "Referencia")}
                {campo("observacao", "Observacoes")}
              </div>
            )}

            <p className="text-xs text-zinc-400">
              Esta edicao muda somente o canal e o endereco.
              Itens, valor pago, caixa e estoque continuam exatamente
              como foram registrados. Nenhuma taxa nova sera cobrada.
            </p>

            {tipo === "balcao" &&
              venda.tipo_atendimento === "delivery" && (
                <p className="text-xs text-amber-300">
                  Ao voltar para balcao, o endereco da entrega sera removido.
                </p>
              )}

            <button
              disabled={ocupado}
              type="submit"
              className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-black text-black disabled:opacity-50"
            >
              {ocupado ? "Salvando..." : "Salvar alteracao"}
            </button>
          </form>
        )}

        {erro && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-500/30 p-3 text-sm text-red-300"
          >
            {erro}
          </p>
        )}
      </div>
    </div>}
  </>;
}
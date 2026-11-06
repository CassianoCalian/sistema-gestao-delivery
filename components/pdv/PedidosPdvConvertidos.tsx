"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Entrega = {
  id: number;
  created_at: string;
  total: number;
  forma_pagamento: string;
  dados_entrega: Record<string, string> | null;
};

type Item = {
  venda_id: number;
  nome_produto: string;
  quantidade: number;
  subtotal: number;
};

const titulos: Record<string, string> = {
  recebido: "Recebido",
  em_preparacao: "Em preparacao",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue"
};

const proximos: Record<string, string[]> = {
  recebido: ["em_preparacao", "saiu_entrega", "entregue"],
  em_preparacao: ["saiu_entrega", "entregue"],
  saiu_entrega: ["entregue"],
  entregue: []
};

const moeda = (valor: number) =>
  Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

export default function PedidosPdvConvertidos({
  idsPermitidos
}: {
  idsPermitidos: number[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [erro, setErro] = useState("");

  const nestaPagina = pathname.replace(/\/$/, "") === "/admin/pedidos";

  async function carregar() {
    setCarregando(true);
    setErro("");

    try {
      const r = await fetch("/api/admin/pdv/entregas-convertidas", {
        cache: "no-store"
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.erro || "Erro na consulta");
      setEntregas(j.entregas || []);
      setItens(j.itens || []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (nestaPagina) void carregar();
  }, [nestaPagina]);

  async function mudar(id: number, status: string) {
    setOcupado(id);
    setErro("");

    try {
      const r = await fetch("/api/admin/pdv/entregas-convertidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venda_id: id, status })
      });
      const j = await r.json();
      if (!r.ok || !j.sucesso) throw Error(j.erro || "Falha");
      await carregar();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setOcupado(null);
    }
  }

  if (!nestaPagina || idsPermitidos.length === 0) return null;

  const visiveis = entregas.filter((v) => idsPermitidos.includes(v.id));

  return <section className="bg-[#080808] px-4 pt-5 text-white">
    <div className="mx-auto max-w-7xl rounded-2xl border border-blue-400/30 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-blue-300">
            Entregas convertidas do PDV
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Vendas corrigidas do balcao para delivery, sem nova baixa de estoque.
          </p>
        </div>
        <button type="button" onClick={() => void carregar()}
          className="rounded-lg border border-white/20 px-3 py-2 text-sm">
          Atualizar
        </button>
      </div>

      {carregando && <p className="mt-3 text-sm">Carregando...</p>}
      {erro && <p role="alert" className="mt-3 text-sm text-red-300">{erro}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visiveis.map(v => {
          const d = v.dados_entrega || {};
          const status = d.status_entrega || "recebido";
          const endereco = [d.rua, d.numero, d.bairro]
            .filter(Boolean).join(", ");

          return <div key={v.id}
            className="rounded-xl border border-white/10 bg-black/40 p-4">

            <div className="flex items-center justify-between gap-2">
              <b>Entrega PDV #{v.id}</b>
              <span className="text-xs font-bold text-blue-300">
                {titulos[status] || status}
              </span>
            </div>

            <p className="mt-2 text-sm font-bold">
              {d.nome || "Cliente nao identificado"}
            </p>
            <p className="text-sm text-zinc-300">{endereco}</p>
            <p className="text-xs text-zinc-400">{d.telefone}</p>
            <p className="mt-2 text-lg font-black text-emerald-300">
              {moeda(v.total)}
            </p>
            <p className="text-xs text-zinc-400">
              Pagamento original: {v.forma_pagamento}
            </p>

            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-bold text-blue-300">
                Ver produtos
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                {itens.filter(i => i.venda_id === v.id).map((i, n) =>
                  <div key={n} className="flex justify-between gap-2">
                    <span>{i.quantidade}x {i.nome_produto}</span>
                    <span>{moeda(i.subtotal)}</span>
                  </div>
                )}
              </div>
            </details>

            <div className="mt-4 flex flex-wrap gap-2">
              {(proximos[status] || []).map(proximo =>
                <button key={proximo} type="button"
                  disabled={ocupado === v.id}
                  onClick={() => void mudar(v.id, proximo)}
                  className="rounded-lg border border-blue-400/40 px-3 py-2 text-xs font-bold text-blue-200 disabled:opacity-50">
                  {ocupado === v.id ? "Salvando..." : titulos[proximo]}
                </button>
              )}
            </div>
          </div>;
        })}
      </div>

      {!carregando && !erro && visiveis.length === 0 &&
        <p className="mt-3 text-sm text-zinc-400">Nenhuma entrega convertida.</p>}
    </div>
  </section>;
}
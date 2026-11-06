"use client";

import { useEffect, useState } from "react";

type Cliente = {
  id: number;
  nome: string;
  telefone: string | null;
};

type Dados = {
  nome: string;
  telefone: string;
  rua?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  complemento?: string;
  referencia?: string;
};

export default function BuscaClientePdv({
  onSelecionar
}: {
  onSelecionar: (dados: Dados) => void;
}) {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) {
      setClientes([]);
      return;
    }

    const controle = new AbortController();

    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/admin/pdv/clientes/busca?q=${encodeURIComponent(q)}`,
          { signal: controle.signal, cache: "no-store" }
        );
        const j = await r.json();
        if (!r.ok) throw Error(j.erro);
        setClientes(j.clientes || []);
      } catch {
        if (!controle.signal.aborted) setErro("Erro ao buscar.");
      }
    }, 300);

    return () => {
      clearTimeout(t);
      controle.abort();
    };
  }, [q]);

  async function selecionar(c: Cliente) {
    setOcupado(true);
    setClientes([]);
    setQ("");
    setErro("");

    const base = {
      nome: c.nome,
      telefone: c.telefone || ""
    };

    onSelecionar(base);

    try {
      const r = await fetch(
        `/api/admin/pdv/clientes/endereco?cliente_id=${c.id}`,
        { cache: "no-store" }
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.erro);

      if (j.encontrado && j.endereco) {
        onSelecionar({ ...base, ...j.endereco });
      }
    } catch {
      setErro("Cliente selecionado. Preencha o endereco manualmente.");
    } finally {
      setOcupado(false);
    }
  }

  return <div className="rounded-xl border border-blue-400/20 bg-black/30 p-3">
    <p className="mb-2 text-sm font-bold text-blue-300">
      Buscar cliente cadastrado
    </p>
    <input
      value={q}
      onChange={e => setQ(e.target.value)}
      placeholder="Digite nome ou telefone..."
      className="w-full rounded-lg border border-white/20 bg-zinc-900 p-3 text-sm text-white"
    />

    <div className="mt-2 max-h-44 overflow-auto">
      {clientes.map(c => (
        <button key={c.id} type="button" disabled={ocupado}
          onClick={() => void selecionar(c)}
          className="block w-full border-b border-white/10 p-3 text-left text-sm hover:bg-blue-500/20">
          <b>{c.nome}</b>
          <span className="ml-2 text-zinc-400">{c.telefone}</span>
        </button>
      ))}
    </div>

    {ocupado && <p className="text-xs text-blue-300">Carregando endereco...</p>}
    {erro && <p className="text-xs text-amber-300">{erro}</p>}
  </div>;
}
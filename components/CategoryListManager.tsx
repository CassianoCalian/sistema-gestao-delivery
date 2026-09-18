"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Categoria = {
  id: number;
  nome: string;
  slug: string;
  icone: string | null;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  quantidadeProdutos: number;
};

type Props = {
  categorias: Categoria[];
};

const ICONES = [
  { valor: "\u{1F37A}", nome: "Cerveja" },
  { valor: "\u{1F943}", nome: "Destilado" },
  { valor: "\u{1F377}", nome: "Vinho" },
  { valor: "\u{1F964}", nome: "Bebida" },
  { valor: "\u{1F4A7}", nome: "Água" },
  { valor: "\u{1F9CA}", nome: "Gelo" },
  { valor: "\u26A1", nome: "Energia" },
  { valor: "\u{1F525}", nome: "Destaque" },
  { valor: "\u{1F3F7}\uFE0F", nome: "Promoção" },
  { valor: "\u{1F37F}", nome: "Petisco" },
  { valor: "\u{1F6CD}\uFE0F", nome: "Outros" },
];

export default function CategoryListManager({
  categorias,
}: Props) {
  const router = useRouter();

  const [editandoId, setEditandoId] =
    useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [icone, setIcone] = useState(
    "\u{1F6CD}\uFE0F",
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  function iniciarEdicao(categoria: Categoria) {
    setEditandoId(categoria.id);
    setNome(categoria.nome);
    setDescricao(categoria.descricao ?? "");
    setIcone(
      categoria.icone || "\u{1F6CD}\uFE0F",
    );
    setErro("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setErro("");
  }

  async function salvarCategoria(
    categoriaId: number,
  ) {
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      setErro("Informe o nome da categoria.");
      return;
    }

    try {
      setSalvando(true);
      setErro("");

      const resposta = await fetch(
        `/api/admin/categorias/${categoriaId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nome: nomeLimpo,
            descricao: descricao.trim(),
            icone,
          }),
        },
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        setErro(
          dados.erro ??
            "Não foi possível salvar a categoria.",
        );
        return;
      }

      setEditandoId(null);
      router.refresh();
    } catch {
      setErro(
        "Não foi possível salvar a categoria.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (categorias.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-500">
        Nenhuma categoria cadastrada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categorias.map((categoria) => {
        const editando =
          editandoId === categoria.id;

        if (editando) {
          return (
            <div
              key={categoria.id}
              className="rounded-2xl border border-amber-400/30 bg-zinc-950 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/5 text-2xl">
                  {icone}
                </div>

                <div>
                  <p className="font-black">
                    Editar categoria
                  </p>

                  <p className="text-xs text-zinc-600">
                    #{categoria.id}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-bold text-zinc-300">
                  Nome
                </label>

                <input
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  maxLength={80}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none transition focus:border-amber-400"
                />
              </div>

              <div className="mt-5">
                <p className="text-sm font-bold text-zinc-300">
                  Ícone
                </p>

                <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-11">
                  {ICONES.map((opcao) => (
                    <button
                      key={opcao.nome}
                      type="button"
                      title={opcao.nome}
                      onClick={() =>
                        setIcone(opcao.valor)
                      }
                      className={`flex aspect-square items-center justify-center rounded-xl border text-2xl transition ${
                        icone === opcao.valor
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                      }`}
                    >
                      {opcao.valor}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-bold text-zinc-300">
                  Descrição
                </label>

                <input
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(event.target.value)
                  }
                  maxLength={120}
                  className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none transition focus:border-amber-400"
                />

                <p className="mt-1 text-xs text-zinc-600">
                  {descricao.length}/120
                </p>
              </div>

              {erro && (
                <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
                  {erro}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    salvarCategoria(categoria.id)
                  }
                  className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                >
                  {salvando
                    ? "Salvando..."
                    : "Salvar alterações"}
                </button>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={cancelarEdicao}
                  className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:border-zinc-500"
                >
                  Cancelar
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={categoria.id}
            className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-zinc-900 text-2xl">
                {categoria.icone ||
                  "\u{1F6CD}\uFE0F"}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-white">
                    {categoria.nome}
                  </p>

                  <span className="rounded-full border border-emerald-900 bg-emerald-950/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-300">
                    Ativa
                  </span>
                </div>

                <p className="mt-1 font-mono text-xs text-zinc-600">
                  /{categoria.slug}
                </p>

                {categoria.descricao && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {categoria.descricao}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                  Produtos
                </p>

                <p className="mt-1 text-lg font-black">
                  {categoria.quantidadeProdutos}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
                  Ordem
                </p>

                <p className="mt-1 text-lg font-black text-zinc-400">
                  {categoria.ordem}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  iniciarEdicao(categoria)
                }
                className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-sm font-black text-amber-400 transition hover:border-amber-400/40 hover:bg-amber-400/10"
              >
                Editar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

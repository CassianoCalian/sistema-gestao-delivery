"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function CategoryAdminForm() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [icone, setIcone] = useState("\u{1F6CD}\uFE0F");

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function cadastrarCategoria(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErro("");
    setSucesso("");

    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      setErro("Informe o nome da categoria.");
      return;
    }

    try {
      setSalvando(true);

      const resposta = await fetch(
        "/api/admin/categorias",
        {
          method: "POST",
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
            "Não foi possível cadastrar a categoria.",
        );

        return;
      }

      setNome("");
      setDescricao("");
      setIcone("\u{1F6CD}\uFE0F");

      setSucesso(
        `Categoria "${dados.categoria.nome}" cadastrada com sucesso.`,
      );

      router.refresh();
    } catch {
      setErro(
        "Não foi possível cadastrar a categoria.",
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={cadastrarCategoria}
      className="rounded-[24px] border border-white/[0.07] bg-zinc-900 p-5 sm:p-6"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">
        Nova categoria
      </p>

      <h2 className="mt-2 text-2xl font-black">
        Adicionar ao catálogo
      </h2>

      <p className="mt-2 text-sm leading-6 text-zinc-500">
        Escolha o nome, o ícone e uma pequena descrição.
      </p>

      <div className="mt-6">
        <label className="text-sm font-bold text-zinc-300">
          Nome
        </label>

        <input
          value={nome}
          onChange={(event) =>
            setNome(event.target.value)
          }
          maxLength={80}
          placeholder="Ex.: Vinhos"
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
        />
      </div>

      <div className="mt-5">
        <label className="text-sm font-bold text-zinc-300">
          Ícone
        </label>

        <div className="mt-3 grid grid-cols-6 gap-2">
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
                  : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
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
          placeholder="Ex.: Vinhos para todos os momentos"
          className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-amber-400"
        />

        <p className="mt-2 text-xs text-zinc-600">
          {descricao.length}/120
        </p>
      </div>

      {erro && (
        <div className="mt-4 rounded-xl border border-red-900 bg-red-950/30 px-4 py-3 text-sm font-bold text-red-300">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="mt-4 rounded-xl border border-emerald-900 bg-emerald-950/30 px-4 py-3 text-sm font-bold text-emerald-300">
          {sucesso}
        </div>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="mt-6 min-h-12 w-full rounded-2xl bg-amber-400 px-5 py-3 font-black text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
      >
        {salvando
          ? "Cadastrando..."
          : "Adicionar categoria"}
      </button>
    </form>
  );
}

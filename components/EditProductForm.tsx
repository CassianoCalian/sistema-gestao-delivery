"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Categoria = {
  id: number;
  nome: string;
  slug: string;
};
type EditProductFormProps = {
  categorias: Categoria[];

  produto: {
    id: number;
    nome: string;
    descricao: string | null;
    preco: number;
    preco_promocional: number | null;
    estoque: number;
    estoque_minimo: number;
    imagem_url: string | null;
    ativo: boolean;
    destaque: boolean;
    em_promocao: boolean;
    categoria_id: number | null;
  };
};

export default function EditProductForm({
  produto,
  categorias,
}: EditProductFormProps) {
  const router = useRouter();

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [arquivoImagem, setArquivoImagem] = useState<File | null>(null);

  const [previewImagem, setPreviewImagem] = useState("");

  const [enviandoImagem, setEnviandoImagem] = useState(false);

  function selecionarImagem(event: ChangeEvent<HTMLInputElement>) {
    setErro("");

    const arquivo = event.target.files?.[0];

    if (!arquivo) {
      setArquivoImagem(null);
      setPreviewImagem("");
      return;
    }

    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];

    if (!tiposPermitidos.includes(arquivo.type)) {
      setErro("Use uma imagem JPG, PNG ou WEBP.");
      event.target.value = "";
      return;
    }

    const tamanhoMaximo = 5 * 1024 * 1024;

    if (arquivo.size > tamanhoMaximo) {
      setErro("A imagem deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }

    setArquivoImagem(arquivo);
    setPreviewImagem(URL.createObjectURL(arquivo));
  }

  async function salvarProduto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSucesso("");
    setSalvando(true);
    const formData = new FormData(event.currentTarget);

    try {
      let imagemFinal = produto.imagem_url ?? "";

      if (arquivoImagem) {
        setEnviandoImagem(true);

        const formDataImagem = new FormData();

        formDataImagem.append("arquivo", arquivoImagem);

        const respostaImagem = await fetch(
          "/api/admin/produtos/upload-imagem",
          {
            method: "POST",
            body: formDataImagem,
          },
        );

        const resultadoImagem = await respostaImagem.json();

        if (!respostaImagem.ok) {
          throw new Error(
            resultadoImagem.erro ?? "Não foi possível enviar a imagem.",
          );
        }

        imagemFinal = resultadoImagem.imagem_url;
      }

      const dados = {
        nome: formData.get("nome")?.toString() ?? "",
        descricao: formData.get("descricao")?.toString() ?? "",

        preco: formData.get("preco")?.toString() ?? "",

        preco_promocional: formData.get("preco_promocional")?.toString() ?? "",

        estoque: formData.get("estoque")?.toString() ?? "",
        estoque_minimo: formData.get("estoque_minimo")?.toString() ?? "",

        imagem_url: imagemFinal,

        ativo: formData.get("ativo") === "on",

        destaque: formData.get("destaque") === "on",

        em_promocao: formData.get("em_promocao") === "on",
        categoria_id: formData.get("categoria_id")?.toString() ?? "",
      };

      const resposta = await fetch(`/api/admin/produtos/${produto.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ?? "Não foi possível atualizar o produto.",
        );
      }

      setSucesso("Produto atualizado com sucesso!");

      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Erro ao atualizar o produto.");
      }
    } finally {
      setSalvando(false);
      setEnviandoImagem(false);
    }
  }

  return (
    <form
      onSubmit={salvarProduto}
      className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-bold">
              Categoria da loja
            </label>

            <select
              name="categoria_id"
              required
              defaultValue={
                produto.categoria_id !== null
                  ? produto.categoria_id.toString()
                  : ""
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
            >
              <option value="">Selecione uma categoria</option>

              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </div>
          <label className="mb-2 block text-sm font-bold">
            Nome do produto
          </label>

          <input
            type="text"
            name="nome"
            required
            defaultValue={produto.nome}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold">Descrição</label>

          <textarea
            name="descricao"
            defaultValue={produto.descricao ?? ""}
            rows={3}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">Preço normal</label>

          <input
            type="number"
            name="preco"
            required
            step="0.01"
            min="0"
            defaultValue={Number(produto.preco)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">
            Preço promocional
          </label>

          <input
            type="number"
            name="preco_promocional"
            step="0.01"
            min="0"
            defaultValue={
              produto.preco_promocional !== null
                ? Number(produto.preco_promocional)
                : ""
            }
            placeholder="Sem promoção"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">Estoque atual</label>

          <input
            type="number"
            name="estoque"
            required
            min="0"
            step="1"
            defaultValue={produto.estoque}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">Estoque mínimo</label>

          <input
            type="number"
            name="estoque_minimo"
            required
            min="0"
            step="1"
            defaultValue={produto.estoque_minimo}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />

          <p className="mt-2 text-xs text-zinc-500">
            O sistema avisará quando o estoque chegar a este limite.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">
            Imagem do produto
          </label>

          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selecionarImagem}
            className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-400 file:px-4 file:py-2 file:font-black file:text-zinc-950"
          />

          <p className="mt-2 text-xs text-zinc-500">
            Escolha uma nova imagem apenas se quiser substituir a atual.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <div>
            <p className="font-black">Produto ativo</p>

            <p className="text-sm text-zinc-500">Produto disponível na loja.</p>
          </div>

          <input
            type="checkbox"
            name="ativo"
            defaultChecked={produto.ativo}
            className="h-5 w-5"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <div>
            <p className="font-black">Em promoção</p>

            <p className="text-sm text-zinc-500">Usar o preço promocional.</p>
          </div>

          <input
            type="checkbox"
            name="em_promocao"
            defaultChecked={produto.em_promocao}
            className="h-5 w-5"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <div>
            <p className="font-black">⭐ Produto em destaque</p>

            <p className="text-sm text-zinc-500">Aparece primeiro na loja.</p>
          </div>

          <input
            type="checkbox"
            name="destaque"
            defaultChecked={produto.destaque}
            className="h-5 w-5"
          />
        </label>
      </div>

      {(previewImagem || produto.imagem_url) && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold">Imagem do produto</p>

          <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-white p-3">
            <img
              src={previewImagem || produto.imagem_url || ""}
              alt={produto.nome}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}

      {sucesso && (
        <div className="mt-6 rounded-xl border border-green-800 bg-green-950/30 p-4 font-bold text-green-400">
          ✅ {sucesso}
        </div>
      )}

      {erro && (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/30 p-4 font-bold text-red-400">
          {erro}
        </div>
      )}

      <button
        type="submit"
        disabled={salvando || enviandoImagem}
        className="mt-8 w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {enviandoImagem
          ? "Enviando imagem..."
          : salvando
            ? "Salvando..."
            : "💾 Salvar alterações"}
      </button>
    </form>
  );
}

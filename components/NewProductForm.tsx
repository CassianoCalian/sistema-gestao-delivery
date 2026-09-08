"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProdutoEncontrado = {
  marca: string;
  quantidade: string;
  categoria: string;
};

type Categoria = {
  id: number;
  nome: string;
  slug: string;
};

type NewProductFormProps = {
  categorias: Categoria[];
};

export default function NewProductForm({ categorias }: NewProductFormProps) {
  const router = useRouter();

  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const [erro, setErro] = useState("");
  const [mensagemBusca, setMensagemBusca] = useState("");

  const [codigoBarras, setCodigoBarras] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [arquivoImagem, setArquivoImagem] = useState<File | null>(null);

  const [previewImagem, setPreviewImagem] = useState("");

  const [enviandoImagem, setEnviandoImagem] = useState(false);

  const [produtoEncontrado, setProdutoEncontrado] =
    useState<ProdutoEncontrado | null>(null);

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

  async function buscarCodigo() {
    setErro("");
    setMensagemBusca("");
    setProdutoEncontrado(null);

    const codigoLimpo = codigoBarras.replace(/\D/g, "");

    if (codigoLimpo.length < 8) {
      setErro("Informe um código de barras válido.");
      return;
    }

    setCodigoBarras(codigoLimpo);
    setBuscando(true);

    try {
      const resposta = await fetch(
        `/api/admin/produtos/buscar-codigo/${encodeURIComponent(codigoLimpo)}`,
      );

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(resultado.erro ?? "Não foi possível buscar o produto.");
      }

      if (!resultado.encontrado) {
        setMensagemBusca(
          "Produto não encontrado. Você pode preencher os dados manualmente.",
        );
        return;
      }

      const produto = resultado.produto;

      setNome(produto.nome ?? "");
      setDescricao(produto.descricao ?? "");
      setImagemUrl(produto.imagem_url ?? "");

      setProdutoEncontrado({
        marca: produto.marca ?? "",
        quantidade: produto.quantidade ?? "",
        categoria: produto.categoria ?? "",
      });

      setMensagemBusca(
        "Produto encontrado! Confira as informações antes de cadastrar.",
      );
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Erro ao buscar código de barras.");
      }
    } finally {
      setBuscando(false);
    }
  }

  async function cadastrarProduto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setSalvando(true);
    const formData = new FormData(event.currentTarget);

    try {
      let imagemFinal = imagemUrl;

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
        codigo_barras: codigoBarras,

        nome: formData.get("nome")?.toString() ?? "",

        descricao: formData.get("descricao")?.toString() ?? "",

        preco: formData.get("preco")?.toString() ?? "",

        preco_promocional: formData.get("preco_promocional")?.toString() ?? "",

        estoque: formData.get("estoque")?.toString() ?? "",
        estoque_minimo: formData.get("estoque_minimo")?.toString() ?? "",

        imagem_url: imagemFinal,

        ativo: formData.get("ativo") === "on",

        em_promocao: formData.get("em_promocao") === "on",
        categoria_id: formData.get("categoria_id")?.toString() ?? "",
      };

      const resposta = await fetch("/api/admin/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ?? "Não foi possível cadastrar o produto.",
        );
      }

      router.push("/admin/produtos");
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setErro(error.message);
      } else {
        setErro("Erro ao cadastrar o produto.");
      }
    } finally {
      setSalvando(false);
      setEnviandoImagem(false);
    }
  }

  return (
    <form
      onSubmit={cadastrarProduto}
      className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-8"
    >
      <div className="mb-8 rounded-2xl border border-amber-400/30 bg-zinc-950 p-5">
        <label className="mb-2 block text-sm font-black text-amber-400">
          Código de barras
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            inputMode="numeric"
            value={codigoBarras}
            onChange={(event) => setCodigoBarras(event.target.value)}
            placeholder="Ex: 7894900010015"
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 outline-none focus:border-amber-400"
          />

          <button
            type="button"
            onClick={buscarCodigo}
            disabled={buscando}
            className="rounded-xl bg-amber-400 px-6 py-3 font-black text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
          >
            {buscando ? "Buscando..." : "🔎 Buscar produto"}
          </button>
        </div>

        {mensagemBusca && (
          <p className="mt-3 text-sm font-bold text-green-400">
            ✅ {mensagemBusca}
          </p>
        )}

        {produtoEncontrado && (
          <div className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-zinc-500">Marca</p>
              <p className="font-bold">
                {produtoEncontrado.marca || "Não informada"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Quantidade</p>
              <p className="font-bold">
                {produtoEncontrado.quantidade || "Não informada"}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Categoria encontrada</p>

              <p className="font-bold">
                {produtoEncontrado.categoria || "Não informada"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold">
            Categoria da loja
          </label>

          <select
            name="categoria_id"
            required
            defaultValue=""
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          >
            <option value="">Selecione uma categoria</option>

            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>

          {produtoEncontrado?.categoria && (
            <p className="mt-2 text-xs text-zinc-500">
              Sugestão encontrada no código de barras:{" "}
              <span className="text-zinc-300">
                {produtoEncontrado.categoria}
              </span>
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold">
            Nome do produto
          </label>

          <input
            type="text"
            name="nome"
            required
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Ex: Antarctica 350ml"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-bold">Descrição</label>

          <textarea
            name="descricao"
            rows={3}
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Descrição do produto"
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">Preço normal</label>

          <input
            type="number"
            name="preco"
            required
            min="0"
            step="0.01"
            placeholder="0,00"
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
            min="0"
            step="0.01"
            placeholder="Opcional"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold">
            Estoque inicial
          </label>

          <input
            type="number"
            name="estoque"
            required
            min="0"
            step="1"
            defaultValue={0}
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
            defaultValue={5}
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
            JPG, PNG ou WEBP. Máximo de 5 MB.
          </p>
        </div>
      </div>

      {(previewImagem || imagemUrl) && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold">Imagem encontrada</p>

          <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-white p-3">
            <img
              src={previewImagem || imagemUrl}
              alt={nome || "Produto"}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <div>
            <p className="font-black">Produto ativo</p>
            <p className="text-sm text-zinc-500">
              Disponível para venda na loja.
            </p>
          </div>

          <input
            type="checkbox"
            name="ativo"
            defaultChecked
            className="h-5 w-5"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-700 bg-zinc-950 p-4">
          <div>
            <p className="font-black">Em promoção</p>
            <p className="text-sm text-zinc-500">
              Utilizar o preço promocional.
            </p>
          </div>

          <input type="checkbox" name="em_promocao" className="h-5 w-5" />
        </label>
      </div>

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
            ? "Cadastrando produto..."
            : "＋ Cadastrar produto"}
      </button>
    </form>
  );
}

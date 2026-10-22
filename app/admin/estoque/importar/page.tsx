"use client";

import { useState } from "react";
import Link from "next/link";
import AdminNavigation from "../../../../components/AdminNavigation";

type Situacao = "novo" | "existente" | "revisar" | "ignorar";

type Produto = {
  linha: number;
  nome: string;
  codigo: string;
  preco: number;
  estoque: number;
  ativoAntigo: boolean;
  categoriaAntiga: string;
  categoriaId: number;
  situacao: Situacao;
  motivo: string;
};

type Categoria = {
  id: number;
  nome: string;
  slug: string;
};

type Resultado = {
  linha: number;
  status: "importado" | "ignorado" | "erro";
  motivo: string;
};

export default function ImportarProdutosPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [categoriasEscolhidas, setCategoriasEscolhidas] = useState<
    Record<number, number>
  >({});
  const [categoriaGeral, setCategoriaGeral] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mensagem, setMensagem] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const novos = produtos.filter((p) => p.situacao === "novo");

  const existentes = produtos.filter((p) => p.situacao === "existente");

  const revisar = produtos.filter((p) => p.situacao === "revisar");

  const ignorados = produtos.filter((p) => p.situacao === "ignorar");

  const visiveis = produtos.filter(
    (p) => filtro === "todos" || p.situacao === filtro,
  );

  const semCategoria = novos.filter(
    (p) => selecionados.includes(p.linha) && !categoriasEscolhidas[p.linha],
  ).length;

  function moeda(valor: number) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function trocarArquivo(file: File | null) {
    setArquivo(file);
    setProdutos([]);
    setCategorias([]);
    setSelecionados([]);
    setCategoriasEscolhidas({});
    setResultados([]);
    setMensagem("");
    setProgresso(0);
  }

  async function analisar() {
    if (!arquivo) {
      setMensagem("Selecione o arquivo Excel primeiro.");
      return;
    }

    setProcessando(true);
    setMensagem("");
    setProdutos([]);
    setResultados([]);
    setSelecionados([]);
    setProgresso(0);

    try {
      const form = new FormData();
      form.append("arquivo", arquivo);

      const resposta = await fetch("/api/admin/importar-produtos", {
        method: "POST",
        body: form,
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.erro ?? "Não foi possível analisar o arquivo.");
      }

      const lista = dados.linhas as Produto[];

      setProdutos(lista);
      setCategorias(dados.categorias as Categoria[]);

      setCategoriasEscolhidas(
        Object.fromEntries(lista.map((p) => [p.linha, p.categoriaId])),
      );

      setMensagem(`Análise concluída! ${lista.length} produtos encontrados.`);
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao analisar o Excel.",
      );
    } finally {
      setProcessando(false);
    }
  }

  function selecionarProduto(linha: number) {
    setSelecionados((atual) =>
      atual.includes(linha)
        ? atual.filter((n) => n !== linha)
        : [...atual, linha],
    );
  }

  function selecionarTodosNovos() {
    setSelecionados(novos.map((p) => p.linha));
  }

  function aplicarCategoria() {
    const id = Number(categoriaGeral);

    if (!id) return;

    setCategoriasEscolhidas((atual) => {
      const resultado = { ...atual };

      for (const linha of selecionados) {
        resultado[linha] = id;
      }

      return resultado;
    });
  }

  async function importar() {
    if (!arquivo || processando) return;

    const escolhidos = novos.filter((p) => selecionados.includes(p.linha));

    if (!escolhidos.length) {
      setMensagem("Selecione os produtos novos.");
      return;
    }

    if (semCategoria > 0) {
      setMensagem(`Existem ${semCategoria} produtos sem categoria.`);
      return;
    }

    const confirmar = window.confirm(
      `Deseja cadastrar ${escolhidos.length} produtos novos?\n\n` +
        "Os produtos existentes NÃO serão alterados.\n" +
        "Os novos serão cadastrados INATIVOS e com estoque ZERO.\n\n" +
        "Confira nomes, preços e categorias antes de continuar.",
    );

    if (!confirmar) return;

    setProcessando(true);
    setProgresso(0);
    setResultados([]);
    setMensagem("");

    const total = escolhidos.length;
    const acumulados: Resultado[] = [];

    try {
      for (let inicio = 0; inicio < total; inicio += 10) {
        const lote = escolhidos.slice(inicio, inicio + 10);

        const form = new FormData();
        form.append("arquivo", arquivo);

        form.append(
          "selecao",
          JSON.stringify(
            lote.map((p) => ({
              linha: p.linha,
              categoriaId: categoriasEscolhidas[p.linha],
            })),
          ),
        );

        const resposta = await fetch("/api/admin/importar-produtos", {
          method: "PUT",
          body: form,
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro ?? "Erro durante a importação.");
        }

        const resultadosLote = dados.resultados as Resultado[];

        acumulados.push(...resultadosLote);
        setResultados([...acumulados]);

        const cadastrados = new Set(
          acumulados
            .filter((r) => r.status === "importado")
            .map((r) => r.linha),
        );

        setProdutos((lista) =>
          lista.map((p) =>
            cadastrados.has(p.linha)
              ? {
                  ...p,
                  situacao: "existente" as Situacao,
                  motivo: "Importado nesta operação",
                }
              : p,
          ),
        );

        setProgresso(Math.round((Math.min(inicio + 10, total) / total) * 100));
      }

      const sucesso = acumulados.filter((r) => r.status === "importado").length;

      const pulados = acumulados.filter((r) => r.status === "ignorado").length;

      const erros = acumulados.filter((r) => r.status === "erro").length;

      setMensagem(
        `Importação finalizada: ${sucesso} cadastrados, ` +
          `${pulados} ignorados e ${erros} erros.`,
      );

      setSelecionados([]);
    } catch (error) {
      setMensagem(
        (error instanceof Error ? error.message : "Falha na importação.") +
          " Reanalise a planilha antes de tentar novamente.",
      );

      setSelecionados([]);
    } finally {
      setProcessando(false);
    }
  }

  function corSituacao(situacao: Situacao) {
    if (situacao === "novo") return "text-emerald-400";
    if (situacao === "existente") return "text-blue-400";
    if (situacao === "revisar") return "text-amber-400";
    return "text-red-400";
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <AdminNavigation />

        <Link
          href="/admin/estoque"
          className="text-sm font-bold text-amber-400"
        >
          ← Voltar ao estoque
        </Link>

        <header className="mt-8">
          <p className="text-xs font-black uppercase tracking-widest text-amber-400">
            Depósito do Zé
          </p>

          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            Importar produtos
          </h1>

          <p className="mt-3 text-zinc-400">
            Adicione produtos de outro PDV sem substituir os produtos
            cadastrados no nosso sistema.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-xl font-black">1. Selecionar planilha</h2>

          <p className="mt-2 text-sm text-zinc-400">
            Escolha o arquivo Excel exportado do PDV antigo.
          </p>

          <input
            type="file"
            accept=".xlsx"
            disabled={processando}
            onChange={(e) => trocarArquivo(e.target.files?.[0] ?? null)}
            className="mt-5 block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-sm"
          />

          <button
            type="button"
            onClick={analisar}
            disabled={!arquivo || processando}
            className="mt-5 rounded-xl bg-amber-400 px-6 py-3 font-black text-zinc-950 disabled:opacity-40"
          >
            {processando ? "Processando..." : "Analisar Excel"}
          </button>
        </section>

        {mensagem && (
          <div
            role="status"
            className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200"
          >
            {mensagem}
          </div>
        )}

        {produtos.length > 0 && (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  titulo: "Produtos novos",
                  quantidade: novos.length,
                  cor: "text-emerald-400",
                },
                {
                  titulo: "Já existentes",
                  quantidade: existentes.length,
                  cor: "text-blue-400",
                },
                {
                  titulo: "Revisar",
                  quantidade: revisar.length,
                  cor: "text-amber-400",
                },
                {
                  titulo: "Ignorados",
                  quantidade: ignorados.length,
                  cor: "text-red-400",
                },
              ].map((item) => (
                <div
                  key={item.titulo}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <p className="text-xs text-zinc-400">{item.titulo}</p>
                  <p className={`mt-2 text-3xl font-black ${item.cor}`}>
                    {item.quantidade}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-black">2. Conferir os produtos</h2>

              <p className="mt-2 text-sm text-zinc-400">
                Apenas os classificados como novos podem ser selecionados. Os
                demais ficam protegidos.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={processando}
                  onClick={selecionarTodosNovos}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold"
                >
                  Selecionar todos os novos
                </button>

                <button
                  type="button"
                  disabled={processando}
                  onClick={() => setSelecionados([])}
                  className="rounded-xl border border-zinc-700 px-4 py-3 text-sm"
                >
                  Limpar seleção
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <select
                  value={categoriaGeral}
                  disabled={processando}
                  onChange={(e) => setCategoriaGeral(e.target.value)}
                  className="min-w-48 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm"
                >
                  <option value="">Escolher categoria em grupo</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={
                    !categoriaGeral || processando || selecionados.length === 0
                  }
                  onClick={aplicarCategoria}
                  className="rounded-xl border border-amber-400 px-4 py-3 text-sm font-bold text-amber-400 disabled:opacity-40"
                >
                  Aplicar aos selecionados
                </button>
              </div>

              <div className="mt-5">
                <select
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm"
                >
                  <option value="todos">Todos os registros</option>
                  <option value="novo">Somente novos</option>
                  <option value="existente">Já cadastrados</option>
                  <option value="revisar">Precisam de revisão</option>
                  <option value="ignorar">Ignorados</option>
                </select>
              </div>

              <div className="mt-5 max-h-[600px] space-y-3 overflow-y-auto pr-1">
                {visiveis.map((p) => (
                  <div
                    key={p.linha}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selecionados.includes(p.linha)}
                        disabled={p.situacao !== "novo" || processando}
                        onChange={() => selecionarProduto(p.linha)}
                        className="mt-1 h-5 w-5 accent-amber-400"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <strong className="text-sm text-white">
                            {p.nome}
                          </strong>

                          <span
                            className={`text-xs font-bold ${corSituacao(p.situacao)}`}
                          >
                            {p.situacao.toUpperCase()}
                          </span>
                        </div>

                        <p className="mt-2 text-xs text-zinc-500">{p.motivo}</p>

                        <p className="mt-2 text-sm font-bold text-amber-400">
                          {moeda(p.preco)}
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Código: {p.codigo || "Sem código válido"}
                          {" | "}
                          Estoque antigo: {p.estoque}
                        </p>

                        {p.categoriaAntiga && (
                          <p className="mt-1 text-xs text-zinc-500">
                            Categoria antiga: {p.categoriaAntiga}
                          </p>
                        )}

                        {p.situacao === "novo" && (
                          <select
                            value={categoriasEscolhidas[p.linha] || ""}
                            disabled={processando}
                            onChange={(e) =>
                              setCategoriasEscolhidas((atual) => ({
                                ...atual,
                                [p.linha]: Number(e.target.value),
                              }))
                            }
                            className="mt-3 w-full max-w-sm rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm"
                          >
                            <option value="">Selecionar categoria</option>

                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nome}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-amber-400/20 bg-zinc-900 p-6">
              <h2 className="text-xl font-black">3. Confirmar importação</h2>

              <p className="mt-3 text-sm text-zinc-400">
                Os novos produtos serão criados inativos e com estoque zero. Os
                produtos existentes não serão alterados.
              </p>

              <div className="mt-5 rounded-xl bg-zinc-950 p-4">
                <p>
                  Selecionados:{" "}
                  <strong className="text-amber-400">
                    {selecionados.length}
                  </strong>
                </p>

                {semCategoria > 0 && (
                  <p className="mt-2 text-sm text-red-400">
                    {semCategoria} produtos sem categoria.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={importar}
                disabled={
                  processando || selecionados.length === 0 || semCategoria > 0
                }
                className="mt-5 w-full rounded-xl bg-amber-400 px-6 py-4 font-black text-zinc-950 disabled:opacity-40"
              >
                {processando
                  ? `Importando... ${progresso}%`
                  : `Confirmar ${selecionados.length} produtos`}
              </button>

              {processando && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              )}
            </section>
          </>
        )}

        {resultados.length > 0 && (
          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="text-lg font-black">Relatório da importação</h2>

            <p className="mt-3 text-sm text-zinc-400">
              Cadastrados:{" "}
              {resultados.filter((r) => r.status === "importado").length}
              {" | "}
              Ignorados:{" "}
              {resultados.filter((r) => r.status === "ignorado").length}
              {" | "}
              Erros: {resultados.filter((r) => r.status === "erro").length}
            </p>

            {resultados
              .filter((r) => r.status !== "importado")
              .map((r) => (
                <p key={r.linha} className="mt-2 text-sm text-amber-400">
                  Linha {r.linha}: {r.motivo}
                </p>
              ))}
          </section>
        )}
      </div>
    </main>
  );
}

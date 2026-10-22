"use client";

import { useEffect, useMemo, useState } from "react";
import ClimaCards from "./ClimaCards";

type Item = {
  chave: string;
  nome: string;
  categoria: string;
  estoque: number | null;
  compartilhado: boolean;
  vendas28: number;
  vendas14: number;
  previsao: number;
  sugestao: number | null;
  motivo: string;
};

type Dados = {
  itens: Item[];
  clima: { data: string; maxima: number | null; chuva: boolean }[];
  inicio: string;
  hoje: string;
  pedidos: number;
  vendas: number;
  analiseIAHabilitada: boolean;
};

const OPCOES = ["Nao definido", "Valtinho", "Barzil", "Outro"];
const STORAGE = "ze-compras-fornecedores-v1";
const STORAGE_MINIMOS = "ze-compras-minimos-v1";

export default function ComprasClient() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [fornecedores, setFornecedores] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [analise, setAnalise] = useState("");
  const [minimos, setMinimos] = useState<Record<string, number>>({});
  const [configProntas, setConfigProntas] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [erroConfig, setErroConfig] = useState("");
  const [pendentes, setPendentes] =
    useState<Record<string, boolean>>({});
  const [legado, setLegado] = useState<{
    fornecedores: Record<string, string>;
    minimos: Record<string, number>;
  } | null>(null);
  const [chavesRemotas, setChavesRemotas] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;

    async function carregarConfiguracoes() {
      try {
        let fornecedoresLocais: Record<string, string> = {};
        let minimosLocais: Record<string, number> = {};

        try {
          fornecedoresLocais = JSON.parse(
            localStorage.getItem(STORAGE) ?? "{}",
          );

          minimosLocais = JSON.parse(
            localStorage.getItem(STORAGE_MINIMOS) ?? "{}",
          );
        } catch {
          // Ignora dados locais invalidos.
        }

        const resposta = await fetch(
          "/api/admin/compras/configuracoes",
          { cache: "no-store" },
        );

        const resultado = await resposta.json();

        if (!resposta.ok ||
            !Array.isArray(resultado.configuracoes)) {
          throw new Error(
            resultado.erro ?? "Falha ao consultar configuracoes.",
          );
        }

        if (!ativo) return;

        const novosFornecedores: Record<string, string> = {};
        const novosMinimos: Record<string, number> = {};

        const chaves = new Set<string>();

        for (const linha of resultado.configuracoes) {
          if (typeof linha.chave !== "string") continue;
          chaves.add(linha.chave);
          novosFornecedores[linha.chave] = linha.fornecedor;

          if (Number.isSafeInteger(linha.estoque_minimo)) {
            novosMinimos[linha.chave] = linha.estoque_minimo;
          }
        }

        setFornecedores(novosFornecedores);
        setMinimos(novosMinimos);
        setChavesRemotas([...chaves]);

        const locaisValidos = {
          fornecedores: Object.fromEntries(
            Object.entries(fornecedoresLocais ?? {}).filter(
              ([chave, valor]) =>
                /^(produto|fisico):[1-9][0-9]{0,17}$/.test(chave) &&
                ["Valtinho", "Barzil", "Outro"].includes(valor) &&
                !chaves.has(chave),
            ),
          ) as Record<string, string>,
          minimos: Object.fromEntries(
            Object.entries(minimosLocais ?? {}).filter(
              ([chave, valor]) =>
                /^(produto|fisico):[1-9][0-9]{0,17}$/.test(chave) &&
                !chaves.has(chave) &&
                typeof valor === "number" &&
                Number.isSafeInteger(valor) &&
                valor >= 0 &&
                valor <= 10000,
            ),
          ) as Record<string, number>,
        };

        if (
          Object.keys(locaisValidos.fornecedores).length ||
          Object.keys(locaisValidos.minimos).length
        ) {
          setLegado(locaisValidos);
        }

        setErroConfig("");
        setConfigProntas(true);
      } catch (erro) {
        if (!ativo) return;
        setErroConfig(
          erro instanceof Error
            ? erro.message
            : "Falha ao conectar ao Supabase.",
        );
        setConfigProntas(false);
      }
    }

    void carregarConfiguracoes();

    return () => {
      ativo = false;
    };
  }, []);

  function marcarPendente(chave: string) {
    setPendentes((atual) => ({ ...atual, [chave]: true }));
  }

  function importarDoNavegador() {
    if (!legado || !configProntas) return;

    const chaves = new Set(chavesRemotas);
    const novasChaves = [
      ...Object.keys(legado.fornecedores),
      ...Object.keys(legado.minimos),
    ].filter((chave) => !chaves.has(chave));

    setFornecedores((atual) => ({
      ...atual,
      ...legado.fornecedores,
    }));

    setMinimos((atual) => ({
      ...atual,
      ...legado.minimos,
    }));

    setPendentes((atual) => ({
      ...atual,
      ...Object.fromEntries(novasChaves.map((chave) => [chave, true])),
    }));

    setLegado(null);
  }

  async function salvarConfiguracoes() {
    if (!configProntas || salvandoConfig) return;

    const chaves = Object.keys(pendentes);

    if (!chaves.length) return;

    setSalvandoConfig(true);
    setErroConfig("");

    try {
      const itens = chaves.map((chave) => ({
        chave,
        fornecedor: fornecedores[chave] ?? "Nao definido",
        estoque_minimo: minimos[chave] ?? null,
      }));

      const resposta = await fetch(
        "/api/admin/compras/configuracoes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itens }),
        },
      );

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.erro ?? "Falha ao salvar configuracoes.",
        );
      }

      setPendentes({});
      setChavesRemotas((atual) => [
        ...new Set([...atual, ...chaves]),
      ]);
      setErroConfig("");

      alert(`${resultado.quantidade} configuracao(oes) salva(s) no Supabase.`);
    } catch (erro) {
      setErroConfig(
        erro instanceof Error ? erro.message : "Falha ao salvar.",
      );
    } finally {
      setSalvandoConfig(false);
    }
  }

  useEffect(() => {
    try {
      const dados = JSON.parse(
        localStorage.getItem(STORAGE_MINIMOS) ?? "{}"
      );
      if (dados && typeof dados === "object" && !Array.isArray(dados)) {
        const validos = Object.fromEntries(
          Object.entries(dados).filter(([, valor]) =>
            typeof valor === "number" &&
            Number.isSafeInteger(valor) &&
            valor >= 0 && valor <= 10000
          )
        ) as Record<string, number>;
        setMinimos(validos);
      }
    } catch {
      // Sem metas anteriores.
    }
  }, []);
  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(STORAGE) ?? "{}");
      if (guardado && typeof guardado === "object" && !Array.isArray(guardado)) {
        setFornecedores(guardado);
      }
    } catch {
      // Continua sem associacoes anteriores.
    }

    fetch("/api/admin/compras", { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.erro ?? "Falha na consulta.");
        setDados(json);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao consultar."))
      .finally(() => setCarregando(false));
  }, []);

  const lista = useMemo(() => (dados?.itens ?? []).filter((item) => {
    const fornecedor = fornecedores[item.chave] ?? "Nao definido";
    return (filtro === "Todos" || filtro === fornecedor) &&
      `${item.nome} ${item.categoria}`.toLowerCase().includes(busca.toLowerCase());
  }), [dados, fornecedores, filtro, busca]);

  function mudarFornecedor(chave: string, nome: string) {
    const novo = { ...fornecedores, [chave]: nome };
    setFornecedores(novo);
    marcarPendente(chave);
    setAnalise("");
    try {
      localStorage.setItem(STORAGE, JSON.stringify(novo));
    } catch {
      setErro("Nao foi possivel salvar fornecedores neste navegador.");
    }
  }

  function sugestaoParaCompra(item: Item): number | null {
    const minimo = minimos[item.chave];
    const estoque = item.estoque;

    if (
      !Number.isSafeInteger(minimo) ||
      minimo < 0 ||
      minimo > 10000 ||
      estoque === null ||
      !Number.isFinite(estoque) ||
      estoque < 0
    ) {
      return item.sugestao;
    }

    const reposicaoManual = Math.max(
      0, minimo - Math.floor(estoque)
    );

    return item.sugestao === null
      ? reposicaoManual
      : Math.max(item.sugestao, reposicaoManual);
  }

  function mudarMinimo(chave: string, texto: string) {
    if (texto !== "" && !/^\d{1,5}$/.test(texto)) return;
    if (texto !== "" && Number(texto) > 10000) return;

    const novos = { ...minimos };

    if (texto === "") {
      delete novos[chave];
    } else {
      novos[chave] = Number(texto);
    }

    setMinimos(novos);
    marcarPendente(chave);
    setAnalise("");

    try {
      localStorage.setItem(
        STORAGE_MINIMOS, JSON.stringify(novos)
      );
    } catch {
      setErro("Nao foi possivel salvar neste navegador.");
    }
  }
  async function executarIA() {
    setAnalisando(true);
    setErro("");
    setAnalise("");

    try {
      const res = await fetch("/api/admin/compras/analise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fornecedores, minimos }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.erro ?? "Analise indisponivel.");

      setAnalise(String(json.analise ?? "A IA nao retornou uma analise."));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao consultar a IA.");
    } finally {
      setAnalisando(false);
    }
  }

  function exportar() {
    const colunas = [
      "Fornecedor", "Produto", "Estoque", "Vendido em 28 dias",
      "Previsao 7 dias", "Minimo manual", "Sugestao de compra", "Motivo",
    ];

    const valores = lista.map((i) => [
      fornecedores[i.chave] ?? "Nao definido",
      i.nome,
      i.estoque ?? "Conferir",
      i.vendas28,
      i.previsao,
      minimos[i.chave] ?? "Nao definido",
      sugestaoParaCompra(i) ?? "Conferir",
      i.motivo,
    ]);

    const escapar = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };

    const csv = "\uFEFF" + [colunas, ...valores]
      .map((linha) => linha.map(escapar).join(";")).join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], {
      type: "text/csv;charset=utf-8",
    }));

    const a = document.createElement("a");
    a.href = url;
    a.download = "compras-deposito-do-ze.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-7xl">
        <a href="/admin" className="text-sm text-amber-400 print:hidden">
          ← Painel administrativo
        </a>

        <h1 className="mt-5 text-3xl font-black">
          Gestao Inteligente de Compras
        </h1>

        <p className="mt-2 text-zinc-400">
          Deposito do Ze — previsao de compras para os proximos 7 dias.
        </p>

        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-zinc-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-white">
                Configuracoes permanentes de compras
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Fornecedores e estoques minimos ficam no Supabase.
                Revise e salve as alteracoes antes de sair.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {legado && configProntas && (
                <button
                  type="button"
                  onClick={importarDoNavegador}
                  className="rounded-xl border border-sky-400/30 px-4 py-2 text-sm font-bold text-sky-200"
                >
                  Importar dados deste navegador
                </button>
              )}

              <button
                type="button"
                disabled={
                  !configProntas ||
                  salvandoConfig ||
                  Object.keys(pendentes).length === 0
                }
                onClick={salvarConfiguracoes}
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black disabled:opacity-40"
              >
                {salvandoConfig
                  ? "Salvando..."
                  : `Salvar no Supabase (${Object.keys(pendentes).length})`}
              </button>
            </div>
          </div>

          {erroConfig && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {erroConfig}
            </p>
          )}

          {configProntas && Object.keys(pendentes).length > 0 && (
            <p className="mt-2 text-xs text-amber-300">
              Alteracoes pendentes. Clique em Salvar no Supabase.
            </p>
          )}

          {configProntas && Object.keys(pendentes).length === 0 && (
            <p className="mt-2 text-xs text-emerald-300">
              Configuracoes sincronizadas.
            </p>
          )}
        </div>
        {carregando && <p className="mt-6">Consultando vendas e estoque...</p>}

        {erro && (
          <p role="alert" className="mt-5 rounded-xl bg-red-950 p-4 text-red-200">
            {erro}
          </p>
        )}

        {dados && (
          <>
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              {[
                ["Pedidos / 28 dias", dados.pedidos],
                ["Vendas PDV / 28 dias", dados.vendas],
                ["Produtos a repor", dados.itens.filter(
                  (i) => (sugestaoParaCompra(i) ?? 0) > 0,
                ).length],
                ["Sem fornecedor", dados.itens.filter(
                  (i) => !fornecedores[i.chave] ||
                    fornecedores[i.chave] === "Nao definido",
                ).length],
              ].map(([titulo, valor]) => (
                <div key={titulo} className="rounded-xl border border-zinc-800 p-4">
                  <p className="text-xs text-zinc-400">{titulo}</p>
                  <p className="mt-2 text-2xl font-black">{valor}</p>
                </div>
              ))}
            </div>

            <ClimaCards clima={dados.clima} />

            <div className="mt-5 flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                disabled={analisando || !dados.analiseIAHabilitada}
                onClick={executarIA}
                className="rounded-xl bg-amber-400 px-5 py-3 font-black text-black disabled:opacity-40"
              >
                {analisando ? "Analisando..." : "Analisar com IA"}
              </button>

              {!dados.analiseIAHabilitada && (
                <span className="self-center text-xs text-amber-300">
                  Configure OPENAI_API_KEY para ativar a IA real.
                </span>
              )}

              <select
                aria-label="Filtrar fornecedor"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="rounded-xl bg-zinc-800 p-3"
              >
                {["Todos", ...OPCOES].map((v) =>
                  <option key={v}>{v}</option>,
                )}
              </select>

              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto"
                className="min-w-0 flex-1 rounded-xl bg-zinc-800 p-3"
              />

              <button onClick={exportar} className="rounded-xl border border-zinc-700 p-3">
                Exportar lista
              </button>

              <button
                onClick={() => window.print()}
                className="rounded-xl border border-zinc-700 p-3"
              >
                Imprimir
              </button>
            </div>

            {analise && (
              <section className="mt-5 whitespace-pre-wrap rounded-xl border border-emerald-800 bg-emerald-950/20 p-5">
                <h2 className="mb-3 font-black text-emerald-300">Analise da IA</h2>
                {analise}
              </section>
            )}

            <p className="mt-5 text-xs text-amber-200">
              As quantidades sao estimativas. Confira estoque fisico,
              mercadorias em transito, prazo e preco do fornecedor.
              Nenhuma compra sera realizada automaticamente.
            </p>

            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
              Estoque minimo = meta informada manualmente.
              Quando nao houver historico suficiente, a
              sugestao usa a diferenca entre meta e estoque.
              Quando houver previsao, considera a maior
              necessidade. Confira antes de comprar.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-300">
                  <tr>
                    {["Produto / estoque", "Fornecedor", "Estoque", "Vendas 28d",
                      "Minimo", "Previsao 7d", "Comprar", "Justificativa"].map((t) =>
                      <th key={t} className="p-3">{t}</th>,
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((i) => (
                    <tr key={i.chave} className="border-t border-zinc-800">
                      <td className="max-w-64 p-3 font-bold">
                        {i.nome}
                        {i.compartilhado && (
                          <p className="text-xs text-amber-300">
                            Estoque compartilhado
                          </p>
                        )}
                      </td>
                      <td className="p-3">
                        <select
                          aria-label={`Fornecedor de ${i.nome}`}
                          disabled={!configProntas || salvandoConfig}
                          value={fornecedores[i.chave] ?? "Nao definido"}
                          onChange={(e) => mudarFornecedor(i.chave, e.target.value)}
                          className="rounded-lg bg-zinc-800 p-2 print:hidden"
                        >
                          {OPCOES.map((v) => <option key={v}>{v}</option>)}
                        </select>
                        <span className="hidden print:inline">
                          {fornecedores[i.chave] ?? "Nao definido"}
                        </span>
                      </td>
                      <td className="p-3">{i.estoque ?? "Conferir"}</td>
                      <td className="p-3">{i.vendas28}</td>
                                            <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          step="1"
                          aria-label={`Estoque minimo de ${i.nome}`}
                          placeholder="Definir"
                          disabled={!configProntas || salvandoConfig}
                          value={minimos[i.chave] ?? ""}
                          onChange={(e) =>
                            mudarMinimo(i.chave, e.target.value)
                          }
                          className="w-24 rounded-lg border border-amber-400/30 bg-zinc-900 p-2 text-sm text-amber-200"
                        />
                      </td>
                      <td className="p-3">{i.previsao}</td>
                      <td className="p-3 font-black text-amber-300">
                        {sugestaoParaCompra(i) ?? "Conferir"}
                      </td>
                      <td className="max-w-72 p-3 text-xs">{i.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Historico desde {dados.inicio}.
              Fornecedores e minimos sao salvos no Supabase pelo botao Salvar.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
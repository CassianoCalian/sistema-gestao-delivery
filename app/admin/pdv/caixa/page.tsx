"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Dinheiro = number | string;

type Turno = {
  id: number;
  caixa_id: number;
  status: "aberto" | "fechado";
  aberto_em: string;
  operador_abertura_email: string;
  valor_inicial: Dinheiro;
  fechado_em: string | null;
  operador_fechamento_email: string | null;
  valor_contado: Dinheiro | null;
  observacao_fechamento: string | null;
};

type Movimentacao = {
  id: number;
  turno_id: number;
  created_at: string;
  tipo: "sangria" | "suprimento";
  valor: Dinheiro;
  motivo: string;
  operador_email: string;
};

type ResumoFinanceiro = {
  turno_id: number;
  quantidade_vendas: number | string;
  total_vendas: Dinheiro;
  vendas_dinheiro: Dinheiro;
  vendas_pix: Dinheiro;
  vendas_debito: Dinheiro;
  vendas_credito: Dinheiro;
  total_sangrias: Dinheiro;
  total_suprimentos: Dinheiro;
  dinheiro_esperado: Dinheiro;
  diferenca_dinheiro: Dinheiro | null;
};

type DadosCaixa = {
  sucesso: boolean;
  caixa: {
    id: number;
    codigo: string;
    nome: string;
    ativo: boolean;
  };
  operador_atual: string;
  turno_aberto: Turno | null;
  turnos: Turno[];
  movimentacoes: Movimentacao[];
  resumos_financeiros: ResumoFinanceiro[];
  vendas_integradas: boolean;
};

type Acao = "abrir" | "movimentar" | "fechar";

function moeda(valor: Dinheiro | null | undefined) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function horario(valor: string | null) {
  if (!valor) return "—";

  return new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lerValor(valor: string) {
  const texto = valor.trim();

  if (!texto) return null;

  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const numero = Number(normalizado);

  if (
    !Number.isFinite(numero) ||
    numero < 0 ||
    numero > 9999999999 ||
    Math.abs(numero * 100 - Math.round(numero * 100)) > 0.000001
  ) {
    return null;
  }

  return Math.round(numero * 100) / 100;
}

function ValorOlhinho({
  texto,
  mascara = "R$ *****",
}: {
  texto: string;
  mascara?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="print:hidden">
        {visivel ? texto : mascara}
      </span>
      <span className="hidden print:inline">{texto}</span>
      <button
        type="button"
        aria-label={visivel ? "Ocultar valor" : "Mostrar valor"}
        aria-pressed={visivel}
        onClick={() => setVisivel(!visivel)}
        className="rounded-lg border border-white/20 px-2 py-1 text-amber-400 print:hidden"
      >
        &#128065;
      </button>
    </span>
  );
}
function BlocoValor({
  titulo,
  valor,
  cor = "text-white",
  detalhe,
}: {
  titulo: string;
  valor: string;
  cor?: string;
  detalhe?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">
        {titulo}
      </p>
      <p className={`mt-2 text-xl font-black ${cor}`}>{valor.startsWith("R$") ? <ValorOlhinho texto={valor} /> : valor}</p>
      {detalhe && <p className="mt-2 text-xs text-zinc-500">{detalhe.startsWith("R$") || detalhe.includes("@") ? <ValorOlhinho texto={detalhe} mascara={detalhe.includes("@") ? "******" : "R$ *****"} /> : detalhe}</p>}
    </div>
  );
}

export default function CaixaPdvPage() {
  const [dados, setDados] = useState<DadosCaixa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [operando, setOperando] = useState(false);

  const [mensagem, setMensagem] = useState("");
  const [sucesso, setSucesso] = useState(false);

  const [valorInicial, setValorInicial] = useState("");
  const [tipoMovimento, setTipoMovimento] = useState<"sangria" | "suprimento">(
    "sangria",
  );
  const [valorMovimento, setValorMovimento] = useState("");
  const [motivo, setMotivo] = useState("");
  const [valorFechamento, setValorFechamento] = useState("");
  const [observacao, setObservacao] = useState("");

  const tentativaRef = useRef<{
    assinatura: string;
    chave: string;
  } | null>(null);

  async function carregar() {
    setCarregando(true);

    try {
      const resposta = await fetch("/api/admin/pdv/caixa", {
        cache: "no-store",
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(resultado.erro ?? "Erro ao consultar o caixa.");
      }

      setDados(resultado as DadosCaixa);
    } catch (error) {
      setDados(null);
      setSucesso(false);
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o caixa.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function executar(
    acao: Acao,
    conteudo: Record<string, string | number>,
  ) {
    if (operando) return;

    setMensagem("");
    setSucesso(false);

    const assinatura = JSON.stringify({
      acao,
      ...conteudo,
    });

    if (tentativaRef.current?.assinatura !== assinatura) {
      tentativaRef.current = {
        assinatura,
        chave: crypto.randomUUID(),
      };
    }

    const chave = tentativaRef.current.chave;

    setOperando(true);

    try {
      const resposta = await fetch("/api/admin/pdv/caixa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acao,
          ...conteudo,
          chave_idempotencia: chave,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok || !resultado.sucesso) {
        throw new Error(
          resultado.erro ?? "Não foi possível realizar a operação.",
        );
      }

      tentativaRef.current = null;
      setSucesso(true);

      if (acao === "abrir") {
        setValorInicial("");
        setMensagem(`Turno #${resultado.id} aberto com sucesso!`);
      } else if (acao === "movimentar") {
        setValorMovimento("");
        setMotivo("");
        setMensagem("Movimentação registrada com sucesso!");
      } else {
        setValorFechamento("");
        setObservacao("");
        setMensagem(`Turno #${resultado.id} fechado com sucesso!`);
      }

      await carregar();
    } catch (error) {
      setSucesso(false);
      setMensagem(
        error instanceof Error
          ? error.message
          : "Falha ao processar a operação.",
      );
    } finally {
      setOperando(false);
    }
  }

  const turno = dados?.turno_aberto ?? null;
  const movimentos = dados?.movimentacoes ?? [];

  const resumos = dados?.resumos_financeiros ?? [];

  const resumoAtual = turno
    ? (resumos.find((item) => Number(item.turno_id) === turno.id) ?? null)
    : null;

  const fechamentoInformado = lerValor(valorFechamento);

  const diferencaPrevista =
    resumoAtual && fechamentoInformado !== null
      ? Math.round(
          (fechamentoInformado - Number(resumoAtual.dinheiro_esperado)) * 100,
        ) / 100
      : null;

  function confirmarFechamento() {
    if (!turno || operando) return;

    if (!dados?.vendas_integradas || !resumoAtual) {
      setSucesso(false);
      setMensagem(
        "Não foi possível consultar o resumo financeiro. Atualize os dados antes de fechar.",
      );
      return;
    }

    if (fechamentoInformado === null) {
      setSucesso(false);
      setMensagem("Informe um valor válido para o dinheiro contado.");
      return;
    }

    const esperado = Number(resumoAtual.dinheiro_esperado);

    const diferenca = diferencaPrevista ?? 0;

    const texto =
      `Deseja realmente fechar o turno #${turno.id}?\n\n` +
      `Dinheiro esperado: ${moeda(esperado)}\n` +
      `Dinheiro contado: ${moeda(fechamentoInformado)}\n` +
      `Diferença: ${moeda(diferenca)}\n\n` +
      `O turno não poderá receber novas vendas ou movimentações.`;

    if (!window.confirm(texto)) return;

    void executar("fechar", {
      turno_id: turno.id,
      valor: fechamentoInformado,
      observacao,
    });
  }

  return (
    <main className="min-h-screen bg-[#070707] px-4 py-6 text-white lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[28px] border border-white/10 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-400">
                Depósito do Zé
              </p>

              <h1 className="mt-2 text-3xl font-black">Controle de Caixa</h1>

              <p className="mt-2 text-sm text-zinc-400">
                Turnos, vendas e conferência financeira.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={operando || carregando}
                onClick={() => void carregar()}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-zinc-300 disabled:opacity-50"
              >
                ↻ Atualizar
              </button>

              <Link
  href="/admin/pdv/fechamento"
  className="rounded-xl border border-amber-400/40 px-4 py-3 text-sm font-bold text-amber-400"
>
  Resumo do Turno
</Link>
<Link
                href="/admin/pdv/historico"
                className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-zinc-300"
              >
                🧾 Histórico
              </Link>

              <Link
                href="/admin/pdv"
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-black"
              >
                ← Voltar ao PDV
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
          <p className="font-black text-amber-300">
            Controle financeiro por turno
          </p>

          <p className="mt-2 text-sm leading-6 text-amber-100/80">
            O resumo considera as vendas vinculadas ao turno, separadas por
            forma de pagamento. Vendas antigas sem vínculo não entram nesses
            totais. Confira os valores antes de encerrar.
          </p>
        </section>

        {mensagem && (
          <div
            className={`mt-5 rounded-xl border p-4 text-sm font-bold ${
              sucesso
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            }`}
          >
            {mensagem}
          </div>
        )}

        {carregando ? (
          <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-10 text-center text-zinc-400">
            Carregando dados do caixa...
          </section>
        ) : !dados ? (
          <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-8 text-center">
            <p className="text-zinc-400">Não foi possível carregar os dados.</p>

            <button
              type="button"
              onClick={() => void carregar()}
              className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black text-black"
            >
              Tentar novamente
            </button>
          </section>
        ) : (
          <>
            <section className="mt-5 grid gap-4 md:grid-cols-3">
              <BlocoValor
                titulo="Caixa"
                valor={dados.caixa.nome}
                detalhe={dados.operador_atual}
              />

              <BlocoValor
                titulo="Situação"
                valor={
                  turno ? `Turno #${turno.id} aberto` : "Nenhum turno aberto"
                }
                cor={turno ? "text-emerald-400" : "text-amber-400"}
                detalhe={
                  turno ? horario(turno.aberto_em) : "Disponível para abertura"
                }
              />

              <BlocoValor
                titulo="Dinheiro inicial"
                valor={moeda(turno?.valor_inicial)}
                cor="text-amber-400"
                detalhe="Valor informado na abertura"
              />
            </section>

            {!turno && (
              <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-6">
                <h2 className="text-xl font-black">🔓 Abrir novo turno</h2>

                <p className="mt-2 text-sm text-zinc-400">
                  Informe o dinheiro físico existente na gaveta antes de iniciar
                  as vendas.
                </p>

                <form
                  className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();

                    const valor = lerValor(valorInicial);

                    if (valor === null) {
                      setSucesso(false);
                      setMensagem(
                        "Informe um valor inicial válido. Use 0,00 se a gaveta estiver vazia.",
                      );
                      return;
                    }

                    void executar("abrir", { valor });
                  }}
                >
                  <div className="flex-1">
                    <label className="mb-2 block text-xs font-bold text-zinc-400">
                      Valor inicial (R$)
                    </label>

                    <input
                      required
                      value={valorInicial}
                      onChange={(event) => setValorInicial(event.target.value)}
                      inputMode="decimal"
                      placeholder="Ex.: 150,00"
                      disabled={operando}
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-white outline-none focus:border-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={operando}
                    className="h-12 rounded-xl bg-emerald-500 px-6 font-black text-black disabled:opacity-50"
                  >
                    {operando ? "Registrando..." : "Abrir turno"}
                  </button>
                </form>
              </section>
            )}

            {turno && (
              <>
                <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-6">
                  <h2 className="text-xl font-black">Turno em andamento</h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Aberto por:{" "}
                    <strong className="text-white">
                      <ValorOlhinho texto={turno.operador_abertura_email} mascara="******" />
                    </strong>
                  </p>

                  {resumoAtual ? (
                    <>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <BlocoValor
                          titulo="Vendas do turno"
                          valor={String(resumoAtual.quantidade_vendas)}
                          detalhe={moeda(resumoAtual.total_vendas)}
                        />

                        <BlocoValor
                          titulo="Dinheiro"
                          valor={moeda(resumoAtual.vendas_dinheiro)}
                          cor="text-emerald-300"
                        />

                        <BlocoValor
                          titulo="Pix"
                          valor={moeda(resumoAtual.vendas_pix)}
                        />

                        <BlocoValor
                          titulo="Débito"
                          valor={moeda(resumoAtual.vendas_debito)}
                        />

                        <BlocoValor
                          titulo="Crédito"
                          valor={moeda(resumoAtual.vendas_credito)}
                        />

                        <BlocoValor
                          titulo="Sangrias"
                          valor={moeda(resumoAtual.total_sangrias)}
                          cor="text-red-300"
                        />

                        <BlocoValor
                          titulo="Suprimentos"
                          valor={moeda(resumoAtual.total_suprimentos)}
                          cor="text-emerald-300"
                        />

                        <BlocoValor
                          titulo="Dinheiro esperado"
                          valor={moeda(resumoAtual.dinheiro_esperado)}
                          cor="text-amber-400"
                          detalhe="Saldo previsto na gaveta"
                        />
                      </div>

                      <p className="mt-4 text-xs text-zinc-500">
                        Dinheiro esperado = valor inicial + vendas em dinheiro +
                        suprimentos − sangrias. Pix e cartões não entram no
                        saldo físico da gaveta.
                      </p>
                    </>
                  ) : (
                    <p className="mt-5 text-sm text-red-300">
                      Resumo financeiro indisponível. Atualize os dados antes de
                      fechar.
                    </p>
                  )}
                </section>

                <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-6">
                  <h2 className="text-xl font-black">Movimentar dinheiro</h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Registre retiradas (sangrias) ou dinheiro colocado na gaveta
                    (suprimentos).
                  </p>

                  <form
                    className="mt-5 space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();

                      const valor = lerValor(valorMovimento);

                      if (valor === null || valor <= 0) {
                        setSucesso(false);
                        setMensagem("Informe um valor maior que zero.");
                        return;
                      }

                      if (motivo.trim().length < 3) {
                        setSucesso(false);
                        setMensagem("Informe o motivo da movimentação.");
                        return;
                      }

                      void executar("movimentar", {
                        turno_id: turno.id,
                        tipo: tipoMovimento,
                        valor,
                        motivo: motivo.trim(),
                      });
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={operando}
                        onClick={() => setTipoMovimento("sangria")}
                        className={`rounded-xl border p-4 text-sm font-black ${
                          tipoMovimento === "sangria"
                            ? "border-red-400 bg-red-500/10 text-red-300"
                            : "border-white/10 bg-black/30 text-zinc-400"
                        }`}
                      >
                        ↗ Sangria (retirada)
                      </button>

                      <button
                        type="button"
                        disabled={operando}
                        onClick={() => setTipoMovimento("suprimento")}
                        className={`rounded-xl border p-4 text-sm font-black ${
                          tipoMovimento === "suprimento"
                            ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                            : "border-white/10 bg-black/30 text-zinc-400"
                        }`}
                      >
                        ↙ Suprimento (entrada)
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-bold text-zinc-400">
                          Valor (R$)
                        </label>

                        <input
                          required
                          value={valorMovimento}
                          onChange={(event) =>
                            setValorMovimento(event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="Ex.: 50,00"
                          disabled={operando}
                          className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold text-zinc-400">
                          Motivo
                        </label>

                        <input
                          required
                          value={motivo}
                          onChange={(event) => setMotivo(event.target.value)}
                          placeholder="Ex.: Retirada para cofre"
                          maxLength={500}
                          disabled={operando}
                          className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={operando}
                      className="h-12 rounded-xl bg-amber-400 px-6 font-black text-black disabled:opacity-50"
                    >
                      {operando ? "Registrando..." : "Registrar movimentação"}
                    </button>
                  </form>
                </section>

                <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-6">
                  <h2 className="text-xl font-black">
                    Movimentações deste turno
                  </h2>

                  {movimentos.length === 0 ? (
                    <p className="mt-4 text-sm text-zinc-500">
                      Nenhuma movimentação registrada.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {movimentos.map((movimento) => (
                        <div
                          key={movimento.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-4"
                        >
                          <div>
                            <p className="text-sm font-black">
                              {movimento.tipo === "sangria"
                                ? "Sangria"
                                : "Suprimento"}
                            </p>

                            <p className="mt-1 text-sm text-zinc-400">
                              {movimento.motivo}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              {horario(movimento.created_at)}
                              {" • "}
                              <ValorOlhinho texto={movimento.operador_email} mascara="******" />
                            </p>
                          </div>

                          <strong
                            className={
                              movimento.tipo === "sangria"
                                ? "text-red-300"
                                : "text-emerald-300"
                            }
                          >
                            {movimento.tipo === "sangria" ? "− " : "+ "}
                            <ValorOlhinho texto={moeda(movimento.valor)} />
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-6">
                  <h2 className="text-xl font-black">🔒 Fechar turno</h2>

                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    Conte o dinheiro físico na gaveta. O sistema calculará a
                    diferença em relação ao valor esperado.
                  </p>

                  <form
                    className="mt-5 space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      confirmarFechamento();
                    }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <BlocoValor
                        titulo="Dinheiro esperado"
                        valor={moeda(resumoAtual?.dinheiro_esperado)}
                        cor="text-amber-400"
                      />

                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <label className="mb-2 block text-xs font-bold text-zinc-400">
                          Dinheiro contado na gaveta (R$)
                        </label>

                        <input
                          required
                          value={valorFechamento}
                          onChange={(event) =>
                            setValorFechamento(event.target.value)
                          }
                          inputMode="decimal"
                          placeholder="Ex.: 250,00"
                          disabled={operando}
                          className="h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {diferencaPrevista !== null && (
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <p className="text-xs font-bold uppercase text-zinc-500">
                          Diferença prevista
                        </p>

                        <p
                          className={`mt-2 text-xl font-black ${
                            diferencaPrevista === 0
                              ? "text-emerald-300"
                              : diferencaPrevista < 0
                                ? "text-red-300"
                                : "text-amber-300"
                          }`}
                        >
                          <ValorOlhinho texto={moeda(diferencaPrevista)} />
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">
                          {diferencaPrevista === 0
                            ? "Caixa conferido"
                            : diferencaPrevista < 0
                              ? "Falta de dinheiro"
                              : "Sobra de dinheiro"}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="mb-2 block text-xs font-bold text-zinc-400">
                        Observações (opcional)
                      </label>

                      <textarea
                        rows={3}
                        value={observacao}
                        onChange={(event) => setObservacao(event.target.value)}
                        maxLength={1000}
                        disabled={operando}
                        placeholder="Ex.: Troca de operador..."
                        className="w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none focus:border-amber-400"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={
                        operando || !resumoAtual || !dados.vendas_integradas
                      }
                      className="h-12 w-full rounded-xl bg-red-500 font-black text-white disabled:opacity-50"
                    >
                      {operando
                        ? "Fechando..."
                        : "Confirmar fechamento do turno"}
                    </button>
                  </form>
                </section>
              </>
            )}

            <section className="mt-5 rounded-[24px] border border-white/10 bg-zinc-950 p-6">
              <h2 className="text-xl font-black">Últimos turnos</h2>

              <p className="mt-1 text-sm text-zinc-500">
                Histórico dos últimos 30 turnos do caixa.
              </p>

              {dados.turnos.length === 0 ? (
                <p className="mt-5 text-sm text-zinc-500">
                  Ainda não existe nenhum turno registrado.
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {dados.turnos.map((item) => {
                    const resumo = resumos.find(
                      (r) => Number(r.turno_id) === item.id,
                    );

                    const diferenca =
                      resumo?.diferenca_dinheiro === null ||
                      resumo?.diferenca_dinheiro === undefined
                        ? null
                        : Number(resumo.diferenca_dinheiro);

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-black">Turno #{item.id}</p>

                            <p className="mt-1 text-xs text-zinc-400">
                              Abertura: {horario(item.aberto_em)}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              <ValorOlhinho texto={item.operador_abertura_email} mascara="******" />
                            </p>
                          </div>

                          <span
                            className={`rounded-lg px-3 py-2 text-xs font-black ${
                              item.status === "aberto"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {item.status === "aberto" ? "ABERTO" : "FECHADO"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                          <BlocoValor
                            titulo="Valor inicial"
                            valor={moeda(item.valor_inicial)}
                          />

                          <BlocoValor
                            titulo="Total de vendas"
                            valor={resumo ? moeda(resumo.total_vendas) : "—"}
                            detalhe={
                              resumo
                                ? `${resumo.quantidade_vendas} venda(s)`
                                : undefined
                            }
                          />

                          <BlocoValor
                            titulo="Dinheiro esperado"
                            valor={
                              resumo ? moeda(resumo.dinheiro_esperado) : "—"
                            }
                          />

                          <BlocoValor
                            titulo="Dinheiro contado"
                            valor={
                              item.valor_contado === null
                                ? "—"
                                : moeda(item.valor_contado)
                            }
                          />
                        </div>

                        {item.status === "fechado" && (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                            <div>
                              <p className="text-xs text-zinc-500">
                                Fechamento
                              </p>
                              <p className="mt-1 text-sm font-bold">
                                {horario(item.fechado_em)}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-zinc-500">Diferença</p>

                              <p
                                className={`mt-1 font-black ${
                                  diferenca === null
                                    ? "text-zinc-400"
                                    : diferenca === 0
                                      ? "text-emerald-300"
                                      : diferenca < 0
                                        ? "text-red-300"
                                        : "text-amber-300"
                                }`}
                              >
                                {diferenca === null ? "—" : <ValorOlhinho texto={moeda(diferenca)} />}
                              </p>
                            </div>
                          </div>
                        )}

                        {item.operador_fechamento_email && (
                          <p className="mt-3 text-xs text-zinc-500">
                            Fechado por: <ValorOlhinho texto={item.operador_fechamento_email} mascara="******" />
                          </p>
                        )}

                        {item.observacao_fechamento && (
                          <p className="mt-2 text-xs text-zinc-400">
                            Observação: {item.observacao_fechamento}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

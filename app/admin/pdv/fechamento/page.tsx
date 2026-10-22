import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ turno?: string }>;
};

function moeda(valor: number) {
  return (Math.round(valor * 100) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function data(valor: string | null) {
  if (!valor) return "Em andamento";
  return new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function valor(valor: unknown) {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error("Valor financeiro invalido.");
  }
  return Math.round(numero * 100) / 100;
}

export default async function ResumoFechamento({ searchParams }: Props) {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  const parametros = await searchParams;

  const { data: caixa, error: erroCaixa } = await supabaseAdmin
    .from("pdv_caixas")
    .select("id")
    .eq("codigo", "principal")
    .single();

  if (erroCaixa || !caixa) {
    return <p className="p-8">Caixa principal indisponivel.</p>;
  }

  const { data: turnos, error: erroTurnos } = await supabaseAdmin
    .from("pdv_turnos")
    .select("id,status,aberto_em,fechado_em,valor_inicial,valor_contado")
    .eq("caixa_id", caixa.id)
    .order("id", { ascending: false })
    .limit(20);

  if (erroTurnos) {
    return <p className="p-8">Falha ao consultar turnos.</p>;
  }

  const idSolicitado = Number(parametros.turno);
  const turno =
    (Number.isSafeInteger(idSolicitado) && idSolicitado > 0
      ? turnos?.find((t) => Number(t.id) === idSolicitado)
      : null) ??
    turnos?.find((t) => t.status === "aberto") ??
    turnos?.[0];

  if (!turno) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <h1 className="text-2xl font-black">Resumo de turno</h1>
        <p className="mt-4">Nenhum turno encontrado.</p>
        <Link href="/admin/pdv/caixa" className="text-amber-400">
          Voltar ao caixa
        </Link>
      </main>
    );
  }

  const inicio = turno.aberto_em;
  const fim = turno.fechado_em ?? new Date().toISOString();

  const [vendasR, pedidosR, movimentosR] = await Promise.all([
    supabaseAdmin
      .from("pdv_vendas")
      .select(
        "id,created_at,turno_id,status,total,forma_pagamento",
        { count: "exact" },
      )
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("id", { ascending: false })
      .limit(1000),

    supabaseAdmin
      .from("pedidos")
      .select(
        "id,created_at,status,total,forma_pagamento,pagamento_confirmado,nome_cliente",
        { count: "exact" },
      )
      .gte("created_at", inicio)
      .lte("created_at", fim)
      .order("id", { ascending: false })
      .limit(1000),

    supabaseAdmin
      .from("pdv_caixa_movimentacoes")
      .select(
        "id,created_at,tipo,valor,motivo",
        { count: "exact" },
      )
      .eq("turno_id", turno.id)
      .order("id", { ascending: false })
      .limit(1000),
  ]);

  if (
    vendasR.error ||
    pedidosR.error ||
    movimentosR.error ||
    [vendasR.count, pedidosR.count, movimentosR.count].some(
      (n) => n === null || n > 1000
    )
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <h1 className="text-2xl font-black">
          Resumo do turno #{turno.id}
        </h1>

        <p className="mt-4 rounded-xl border border-red-500/30 p-4 text-red-300">
          A consulta nao retornou todos os registros.
          Totais ocultados para evitar fechamento incorreto.
        </p>

        <Link href="/admin/pdv/caixa" className="text-amber-400">
          Voltar ao caixa
        </Link>
      </main>
    );
  }

  const vendas = vendasR.data ?? [];
  const pedidos = pedidosR.data ?? [];
  const movimentos = movimentosR.data ?? [];

  const balcao = vendas.filter(
    (v) => Number(v.turno_id) === Number(turno.id) &&
      v.status === "concluida",
  );

  const semVinculo = vendas.filter(
    (v) => v.status === "concluida" &&
      Number(v.turno_id) !== Number(turno.id),
  );

  const entregas = pedidos.filter(
    (p) => p.status !== "cancelado",
  );

  const pagos = entregas.filter(
    (p) => p.pagamento_confirmado === true,
  );

  const pendentes = entregas.filter(
    (p) => p.pagamento_confirmado !== true,
  );

  const cancelados = pedidos.filter(
    (p) => p.status === "cancelado",
  );

  function total(itens: { total: unknown }[]) {
    return itens.reduce((s, i) => s + valor(i.total), 0);
  }

  const totalBalcao = total(balcao);
  const totalEntregasPagas = total(pagos);
  const totalPendente = total(pendentes);

  const sangrias = movimentos
    .filter((m) => m.tipo === "sangria")
    .reduce((s, m) => s + valor(m.valor), 0);

  const suprimentos = movimentos
    .filter((m) => m.tipo === "suprimento")
    .reduce((s, m) => s + valor(m.valor), 0);

  const pagamentos = [
    "dinheiro",
    "pix",
    "debito",
    "credito",
    "cartao_entrega",
  ];

  const linhas = [
    ...balcao.map((v) => ({
      chave: `b${v.id}`,
      titulo: `Balcao #${v.id}`,
      horario: v.created_at,
      forma: v.forma_pagamento,
      situacao: "Concluida",
      total: valor(v.total),
      destino: `/admin/pdv/historico`,
    })),
    ...pedidos.map((p) => ({
      chave: `e${p.id}`,
      titulo: `Entrega #${p.id} - ${p.nome_cliente}`,
      horario: p.created_at,
      forma: p.forma_pagamento,
      situacao:
        p.status === "cancelado"
          ? "Cancelado - conferir estorno se pago"
          : p.pagamento_confirmado
            ? "Pagamento confirmado"
            : "Pagamento pendente",
      total: valor(p.total),
      destino: `/admin/pedidos/${p.id}`,
    })),
    ...semVinculo.map((v) => ({
      chave: `s${v.id}`,
      titulo: `PDV #${v.id} - outro turno ou sem vinculo`,
      horario: v.created_at,
      forma: v.forma_pagamento,
      situacao: "CONFERIR VINCULO",
      total: valor(v.total),
      destino: "/admin/pdv/historico",
    })),
  ].sort(
    (a, b) =>
      new Date(b.horario).getTime() -
      new Date(a.horario).getTime(),
  );

  return (
    <main className="min-h-screen bg-[#090909] px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-400">
              Deposito do Ze
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Relatorio consolidado do turno
            </h1>
          </div>

          <Link
            href="/admin/pdv/caixa"
            className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold"
          >
            Voltar ao caixa
          </Link>
        </div>

        <p className="mt-3 text-sm text-zinc-400">
          Turno #{turno.id} - {turno.status}
          {" | "}Inicio: {data(inicio)}
          {" | "}Fim: {data(fim)}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {(turnos ?? []).map((t) => (
            <Link
              key={t.id}
              href={`/admin/pdv/fechamento?turno=${t.id}`}
              className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                t.id === turno.id
                  ? "border-amber-400 text-amber-300"
                  : "border-white/15 text-zinc-400"
              }`}
            >
              Turno #{t.id}
            </Link>
          ))}
        </div>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">
          O caixa financeiro oficial contabiliza as vendas do PDV.
          Este relatorio mostra tambem entregas registradas durante
          o horario do turno. Elas nao possuem necessariamente
          vinculo financeiro com o caixa fisico. Uma entrega paga
          nao significa dinheiro colocado na gaveta.
        </div>

        {semVinculo.length > 0 && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-200">
            ATENCAO: {semVinculo.length} venda(s) presencial(is)
            no periodo pertencem a outro turno ou estao sem
            vinculo. Confira antes do fechamento.
          </p>
        )}

        <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-950 p-5">
          <input
            id="mostrar-financeiro"
            type="checkbox"
            className="peer sr-only"
          />

          <label
            htmlFor="mostrar-financeiro"
            className="inline-flex cursor-pointer select-none items-center gap-2 rounded-xl bg-amber-400 px-4 py-3 font-black text-black"
          >
            <span className="peer-checked:hidden">👁️ Mostrar valores e detalhes</span>
            <span className="hidden peer-checked:inline">🙈 Ocultar valores</span>
          </label>

          <p className="mt-3 text-xs text-zinc-400 peer-checked:hidden">
            Valores financeiros e nomes de clientes ocultos.
            Clique no olhinho para visualizar.
          </p>

          <div className="mt-6 hidden peer-checked:block print:block">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Balcao recebido", totalBalcao],
                ["Entregas com pagamento confirmado", totalEntregasPagas],
                ["Total confirmado (operacional)", totalBalcao + totalEntregasPagas],
                ["Entregas pendentes", totalPendente],
                ["Dinheiro inicial do turno", valor(turno.valor_inicial)],
                ["Dinheiro contado ao fechar", turno.valor_contado === null ? null : valor(turno.valor_contado)],
                ["Sangrias", sangrias],
                ["Suprimentos", suprimentos],
              ].map(([nome, montante]) => (
                <div
                  key={String(nome)}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <p className="text-xs text-zinc-400">{nome}</p>
                  <p className="mt-2 text-xl font-black">
                    {montante === null ? "Pendente" : moeda(Number(montante))}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 p-4">
                <h2 className="text-lg font-black">
                  Balcao: {balcao.length} venda(s)
                </h2>
                {pagamentos.map((forma) => {
                  const grupo = balcao.filter(
                    (v) => v.forma_pagamento === forma,
                  );
                  return (
                    <p key={forma} className="mt-2 flex justify-between gap-3 text-sm">
                      <span>{forma} ({grupo.length})</span>
                      <strong>{moeda(total(grupo))}</strong>
                    </p>
                  );
                })}
              </div>

              <div className="rounded-xl border border-white/10 p-4">
                <h2 className="text-lg font-black">
                  Entregas: {pedidos.length} pedido(s)
                </h2>
                <p className="mt-2">
                  Pagos: {pagos.length} - {moeda(totalEntregasPagas)}
                </p>
                <p className="mt-2">
                  Pendentes: {pendentes.length} - {moeda(totalPendente)}
                </p>
                <p className="mt-2">
                  Cancelados: {cancelados.length}
                </p>
              </div>
            </div>

            <h2 className="mt-7 text-lg font-black">
              Operacoes do periodo
            </h2>

            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-300">
                  <tr>
                    {["Operacao", "Horario", "Pagamento", "Situacao", "Valor"].map((t) => (
                      <th key={t} className="p-3">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((linha) => (
                    <tr key={linha.chave} className="border-t border-white/10">
                      <td className="p-3">
                        <Link href={linha.destino} className="text-amber-300 underline">
                          {linha.titulo}
                        </Link>
                      </td>
                      <td className="p-3">{data(linha.horario)}</td>
                      <td className="p-3">{linha.forma}</td>
                      <td className="p-3">{linha.situacao}</td>
                      <td className="p-3 font-bold">{moeda(linha.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!linhas.length && (
                <p className="p-4 text-zinc-400">Sem registros no periodo.</p>
              )}
            </div>

            <p className="mt-5 text-xs leading-6 text-zinc-400">
              Relatorio operacional somente de leitura. Entregas
              estao agrupadas pelo horario de criacao e incluem
              pedidos do site e do PDV. O total confirmado
              nao representa, por si so, o saldo da gaveta.
              Valores pendentes nao foram somados como recebidos.
              Confira estornos e pagamentos na area Pedidos.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
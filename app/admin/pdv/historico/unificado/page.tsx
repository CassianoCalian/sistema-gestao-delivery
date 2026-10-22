import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import CancelarEntrega from "./CancelarEntrega";
import CancelarVendaBalcao from "./CancelarVendaBalcao";

export const dynamic = "force-dynamic";

function moeda(valor: unknown) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function mostrarParcelas(detalhes: unknown) {
  if (!detalhes || typeof detalhes !== "object") return null;

  const valor = detalhes as {
    parcelas?: { forma: string; valor: number }[];
  };

  if (!Array.isArray(valor.parcelas) || valor.parcelas.length < 2) return null;

  return (
    <div className="mt-2 rounded-lg border border-amber-400/20 p-3">
      <p className="mb-2 font-bold text-amber-300">Pagamento dividido</p>

      {valor.parcelas.map((p, i) => (
        <p key={i} className="text-sm">
          {p.forma.toUpperCase()}: {moeda(p.valor)}
        </p>
      ))}
    </div>
  );
}

function horario(valor: string) {
  return new Date(valor).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function HistoricoUnificado() {
  try {
    await requireAdmin();
  } catch {
    redirect("/admin/login");
  }

  // Busca somente o turno que esta aberto agora.
  const { data: caixa, error: erroCaixa } = await supabaseAdmin
    .from("pdv_caixas")
    .select("id")
    .eq("codigo", "principal")
    .maybeSingle();

  if (erroCaixa || !caixa) {
    throw new Error("Nao foi possivel consultar o caixa principal.");
  }

  const { data: turno, error: erroTurno } = await supabaseAdmin
    .from("pdv_turnos")
    .select("id,aberto_em")
    .eq("caixa_id", caixa.id)
    .eq("status", "aberto")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroTurno) {
    throw new Error("Nao foi possivel consultar o turno atual.");
  }

  // Turno fechado: nao exibe vendas antigas.
  if (!turno) {
    return (
      <main className="min-h-screen bg-[#080808] p-6 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-3xl font-black">Historico do Turno</h1>

          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-zinc-950 p-6">
            <p className="text-xl font-black text-amber-400">
              Nenhum turno aberto
            </p>

            <p className="mt-3 text-zinc-400">
              Balcao: 0 vendas | Delivery: 0 pedidos
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Abra um novo turno para iniciar a contagem. As vendas anteriores
              permanecem registradas.
            </p>
          </div>

          <Link
            href="/admin/pdv"
            className="mt-5 inline-block rounded-xl bg-amber-400 px-5 py-3 font-black text-black"
          >
            Voltar ao PDV
          </Link>
        </div>
      </main>
    );
  }

  const agora = new Date().toISOString();

  // Balcao: vendas vinculadas ao turno atual.
  // Delivery: pedidos criados durante este turno.
  const [vendasR, pedidosR, qtdBalcaoR, qtdDeliveryR] = await Promise.all([
    supabaseAdmin
      .from("pdv_vendas")
      .select(
        "id,created_at,total,status,forma_pagamento,turno_id,pagamentos_detalhes",
      )
      .eq("turno_id", turno.id)
      .order("id", { ascending: false })
      .limit(100),

    supabaseAdmin
      .from("pedidos")
      .select(
        "id,created_at,total,status,forma_pagamento,pagamento_confirmado,nome_cliente,pagamentos_detalhes",
      )
      .gte("created_at", turno.aberto_em)
      .lte("created_at", agora)
      .order("id", { ascending: false })
      .limit(100),

    supabaseAdmin
      .from("pdv_vendas")
      .select("id", { count: "exact", head: true })
      .eq("turno_id", turno.id)
      .eq("status", "concluida"),

    supabaseAdmin
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", turno.aberto_em)
      .lte("created_at", agora)
      .neq("status", "cancelado"),
  ]);

  if (
    vendasR.error ||
    pedidosR.error ||
    qtdBalcaoR.error ||
    qtdDeliveryR.error ||
    qtdBalcaoR.count === null ||
    qtdDeliveryR.count === null
  ) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <h1 className="text-2xl font-black">Historico de vendas</h1>
        <p className="mt-4 text-red-300">
          Consulta indisponivel. Nenhum registro foi alterado.
        </p>
        <Link href="/admin/pdv" className="text-amber-400">
          Voltar ao PDV
        </Link>
      </main>
    );
  }

  const vendas = vendasR.data ?? [];
  const pedidos = pedidosR.data ?? [];

  return (
    <main className="min-h-screen bg-[#080808] p-4 text-white lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-amber-400">
              Deposito do Ze
            </p>
            <h1 className="mt-2 text-3xl font-black">Historico do Turno</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Balcao e delivery separados, com contagem individual.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/pdv"
              className="rounded-xl border border-white/20 px-4 py-3 font-bold"
            >
              Voltar ao PDV
            </Link>
            <Link
              href="/admin/pdv/historico"
              className="rounded-xl border border-white/20 px-4 py-3 text-sm"
            >
              Historico anterior
            </Link>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-amber-400/30 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-400">Vendas no balcao</p>
            <p className="mt-2 text-4xl font-black text-amber-400">
              {qtdBalcaoR.count}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-400/30 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-400">Pedidos de delivery</p>
            <p className="mt-2 text-4xl font-black text-blue-300">
              {qtdDeliveryR.count}
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/30 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-400">Total de atendimentos</p>
            <p className="mt-2 text-4xl font-black text-emerald-300">
              {qtdBalcaoR.count + qtdDeliveryR.count}
            </p>
          </div>
        </section>

        <p className="mt-3 text-xs text-zinc-500">
          Contagem somente do turno atual. Para a contagem do turno atual,
          consulte o contador na tela do PDV. As listas exibem os 100 registros
          mais recentes por canal, incluindo os cancelados para auditoria.
        </p>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <section className="rounded-2xl border border-amber-400/20 bg-zinc-950 p-5">
            <h2 className="text-xl font-black text-amber-400">
              Vendas de Balcao
            </h2>

            <div className="mt-4 space-y-3">
              {vendas.length === 0 && (
                <p className="text-zinc-400">Nenhuma venda registrada.</p>
              )}

              {vendas.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-black">Venda #{v.id}</p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {horario(v.created_at)}
                      </p>
                    </div>

                    <span className="text-xs font-bold text-zinc-300">
                      {v.status}
                    </span>
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-bold text-amber-400">
                      Mostrar valor e pagamento
                    </summary>
                    <div className="mt-3 space-y-2 text-sm">
                      <p>Valor: {moeda(v.total)}</p>
                      <p>Pagamento: {v.forma_pagamento}</p>
                      {mostrarParcelas(v.pagamentos_detalhes)}
                      <p>Turno: {v.turno_id ?? "Nao vinculado"}</p>
                    </div>
                  </details>

                  {v.status === "concluida" &&
                  Number(v.turno_id) === turno.id ? (
                    <CancelarVendaBalcao id={v.id} total={Number(v.total)} />
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      {v.status === "cancelada"
                        ? "Venda cancelada"
                        : "Cancelamento permitido somente no turno aberto."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-400/20 bg-zinc-950 p-5">
            <h2 className="text-xl font-black text-blue-300">
              Pedidos de Delivery
            </h2>

            <div className="mt-4 space-y-3">
              {pedidos.length === 0 && (
                <p className="text-zinc-400">Nenhum pedido registrado.</p>
              )}

              {pedidos.map((pedido) => {
                const cancelavel =
                  true &&
                  (pedido.status === "recebido" ||
                    pedido.status === "em_preparacao");

                return (
                  <div
                    key={pedido.id}
                    className="rounded-xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-black">Delivery #{pedido.id}</p>
                        <p className="mt-1 text-xs text-zinc-400">
                          {horario(pedido.created_at)}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-zinc-300">
                        {pedido.status}
                      </span>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-bold text-blue-300">
                        Mostrar cliente e valor
                      </summary>
                      <div className="mt-3 space-y-2 text-sm">
                        <p>Cliente: {pedido.nome_cliente}</p>
                        <p>Valor: {moeda(pedido.total)}</p>
                        <p>Pagamento: {pedido.forma_pagamento}</p>
                        {mostrarParcelas(pedido.pagamentos_detalhes)}
                        <p>
                          Situacao financeira:{" "}
                          {pedido.pagamento_confirmado
                            ? "Confirmado"
                            : "Pendente"}
                        </p>
                      </div>
                    </details>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/pedidos/${pedido.id}`}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm font-bold"
                      >
                        Ver pedido
                      </Link>

                      {cancelavel && (
                        <CancelarEntrega
                          id={pedido.id}
                          pago={pedido.pagamento_confirmado === true}
                        />
                      )}

                      {!cancelavel && pedido.status !== "cancelado" && (
                        <span className="self-center text-xs text-zinc-500">
                          Cancelamento requer conferencia.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

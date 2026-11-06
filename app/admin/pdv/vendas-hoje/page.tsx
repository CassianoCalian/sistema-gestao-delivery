import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import AdminNavigation from "../../../../components/AdminNavigation";

export const dynamic = "force-dynamic";

type Venda = {
  id: number;
  created_at: string;
  total: number;
  status: string;
  forma_pagamento: string;
};

type Entrega = Venda & {
  nome_cliente: string;
  pagamento_confirmado: boolean;
};

function dinheiro(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function horario(data: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

export default async function VendasHoje() {
  if (!(await verificarAdmin())) redirect("/admin/login");

  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const inicio = new Date(`${hoje}T00:00:00-03:00`);
  const fim = new Date(inicio.getTime() + 86400000);

  const [resVendas, resEntregas] = await Promise.all([
    supabaseAdmin
      .from("pdv_vendas")
      .select("id,created_at,total,status,forma_pagamento")
      .gte("created_at", inicio.toISOString())
      .lt("created_at", fim.toISOString())
      .order("created_at", { ascending: false }),

    supabaseAdmin
      .from("pedidos")
      .select("id,created_at,total,status,forma_pagamento,nome_cliente,pagamento_confirmado")
      .gte("created_at", inicio.toISOString())
      .lt("created_at", fim.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (resVendas.error || resEntregas.error) {
    return (
      <main className="min-h-screen bg-zinc-950 p-6 text-white">
        <AdminNavigation />
        <p className="mt-8 text-red-400">
          Nao foi possivel consultar as vendas de hoje.
        </p>
      </main>
    );
  }

  const vendas = (resVendas.data ?? []) as Venda[];
  const entregas = (resEntregas.data ?? []) as Entrega[];

  const validas = vendas.filter((v) => v.status === "concluida");
  const entregasValidas = entregas.filter((v) => v.status !== "cancelado");

  const totalBalcao = validas.reduce((s, v) => s + Number(v.total), 0);
  const totalDelivery = entregasValidas.reduce(
    (s, v) => s + Number(v.total), 0,
  );
  const recebidoDelivery = entregasValidas
    .filter((v) => v.pagamento_confirmado)
    .reduce((s, v) => s + Number(v.total), 0);

  const registros = [
    ...vendas.map((v) => ({
      chave: `b-${v.id}`,
      id: v.id,
      tipo: "BALCAO",
      cliente: "Venda presencial",
      data: v.created_at,
      total: Number(v.total),
      pagamento: v.forma_pagamento,
      status: v.status,
      pago: v.status === "concluida",
      cancelado: v.status === "cancelada",
      href: "",
    })),
    ...entregas.map((v) => ({
      chave: `d-${v.id}`,
      id: v.id,
      tipo: "DELIVERY",
      cliente: v.nome_cliente,
      data: v.created_at,
      total: Number(v.total),
      pagamento: v.forma_pagamento,
      status: v.status,
      pago: Boolean(v.pagamento_confirmado),
      cancelado: v.status === "cancelado",
      href: `/admin/pedidos/${v.id}`,
    })),
  ].sort(
    (a, b) =>
      new Date(b.data).getTime() - new Date(a.data).getTime(),
  );

  const indicadores = [
    ["Balcao", totalBalcao],
    ["Delivery", totalDelivery],
    ["Total vendido", totalBalcao + totalDelivery],
    ["Pagamento confirmado", totalBalcao + recebidoDelivery],
    ["Delivery a receber", totalDelivery - recebidoDelivery],
  ] as const;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation />

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-amber-400">
              Movimento de hoje - {hoje}
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Vendas do dia
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Balcao e delivery. Consulta sem fechar o caixa.
            </p>
          </div>

          <Link
            href="/admin/pedidos"
            className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold"
          >
            Voltar aos pedidos
          </Link>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {indicadores.map(([nome, valor]) => (
            <div
              key={nome}
              className="rounded-2xl border border-amber-400/15 bg-white/[0.035] p-4"
            >
              <p className="text-xs text-zinc-400">{nome}</p>
              <p className="mt-2 text-xl font-black text-amber-400">
                {dinheiro(valor)}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Total vendido inclui entregas ainda nao pagas.
          Cancelamentos nao entram nos totais.
        </p>

        <div className="mt-8 space-y-3">
          {registros.length === 0 && (
            <p className="rounded-2xl border border-white/10 p-6 text-zinc-400">
              Nenhuma venda registrada hoje.
            </p>
          )}

          {registros.map((item) => (
            <div
              key={item.chave}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5"
            >
              <div>
                <p className="text-xs font-bold text-amber-400">
                  {item.tipo} #{item.id} - {horario(item.data)}
                </p>
                <p className="mt-1 font-bold">{item.cliente}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.pagamento} | {item.status}
                </p>
              </div>

              <div className="text-right">
                <p className="text-lg font-black">
                  {dinheiro(item.total)}
                </p>
                <p
                  className={`text-xs font-bold ${
                    item.cancelado
                      ? "text-red-400"
                      : item.pago
                        ? "text-emerald-400"
                        : "text-amber-400"
                  }`}
                >
                  {item.cancelado
                    ? "CANCELADO"
                    : item.pago
                      ? "PAGO"
                      : "A RECEBER"}
                </p>

                {item.href && (
                  <Link
                    href={item.href}
                    className="mt-2 inline-block text-xs text-amber-400 underline"
                  >
                    Ver detalhes
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
import { NextResponse } from "next/server";
import { verificarAdmin } from "../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pedido = {
  id: number;
  total: number;
  status: string;
  created_at: string;
};

type Venda = {
  id: number;
  total: number;
  status: string;
  tipo_atendimento: string;
  created_at: string;
};

async function buscarTudo<T>(
  tabela: "pedidos" | "pdv_vendas",
  colunas: string,
  inicio: string,
  fim: string
): Promise<T[]> {
  const resultado: T[] = [];

  for (let offset = 0; offset < 50000; offset += 500) {
    const { data, error } = await supabaseAdmin
      .from(tabela)
      .select(colunas)
      .gte("created_at", inicio)
      .lt("created_at", fim)
      .order("id", { ascending: true })
      .range(offset, offset + 499);

    if (error) throw error;

    const lote = (data ?? []) as unknown as T[];
    resultado.push(...lote);

    if (lote.length < 500) return resultado;
  }

  throw new Error("Limite de consulta atingido.");
}

const somar = (valores: number[]) =>
  Math.round(
    valores.reduce((acc, n) => acc + Math.round(n * 100), 0)
  ) / 100;

export async function GET(request: Request) {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    return NextResponse.json(
      { erro: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const modo =
      new URL(request.url).searchParams.get("modo") === "turno"
        ? "turno"
        : "hoje";

    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());

    let inicio = new Date(`${hoje}T00:00:00-03:00`);
    let fim = new Date(inicio.getTime() + 86400000);
    let periodo = `Hoje - ${hoje}`;

    if (modo === "turno") {
      const { data: turno, error } = await supabaseAdmin
        .from("pdv_turnos")
        .select("id,aberto_em,fechado_em,status")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!turno) {
        return NextResponse.json(
          { vazio: true },
          { headers: { "Cache-Control": "private, no-store" } }
        );
      }

      inicio = new Date(turno.aberto_em);
      fim = turno.fechado_em
        ? new Date(turno.fechado_em)
        : new Date();

      fim = new Date(fim.getTime() + 1);
      periodo = `Turno #${turno.id} - ${turno.status}`;
    }

    const [pedidos, vendas] = await Promise.all([
      buscarTudo<Pedido>(
        "pedidos",
        "id,total,status,created_at",
        inicio.toISOString(),
        fim.toISOString()
      ),
      buscarTudo<Venda>(
        "pdv_vendas",
        "id,total,status,tipo_atendimento,created_at",
        inicio.toISOString(),
        fim.toISOString()
      )
    ]);

    const pedidosValidos = pedidos.filter(
      p => p.status !== "cancelado"
    );

    const vendasValidas = vendas.filter(
      v => v.status === "concluida"
    );

    const vendasBalcao = vendasValidas.filter(
      v => v.tipo_atendimento !== "delivery"
    );

    const vendasConvertidas = vendasValidas.filter(
      v => v.tipo_atendimento === "delivery"
    );

    const totalBalcao = somar(
      vendasBalcao.map(v => Number(v.total))
    );

    const totalPedidos = somar(
      pedidosValidos.map(p => Number(p.total))
    );

    const totalConvertidas = somar(
      vendasConvertidas.map(v => Number(v.total))
    );

    return NextResponse.json({
      periodo,
      balcao: {
        quantidade: vendasBalcao.length,
        valor: totalBalcao
      },
      deliveryPedidos: {
        quantidade: pedidosValidos.length,
        valor: totalPedidos
      },
      deliveryConvertido: {
        quantidade: vendasConvertidas.length,
        valor: totalConvertidas
      },
      delivery: {
        quantidade: pedidosValidos.length + vendasConvertidas.length,
        valor: somar([totalPedidos, totalConvertidas])
      },
      geral: {
        quantidade: pedidosValidos.length + vendasValidas.length,
        valor: somar([totalBalcao, totalPedidos, totalConvertidas])
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    console.error("Erro na apuracao unificada:", error);

    return NextResponse.json(
      { erro: "Faturamento unificado indisponivel." },
      { status: 500 }
    );
  }
}
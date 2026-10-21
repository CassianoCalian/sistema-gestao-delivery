import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/requireAdmin";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Registro = { id: number; created_at: string; status: string };
type Item = { produto_id: number; quantidade: number; pedido_id?: number; venda_id?: number };
type Config = { produto_id: number; estoque_compartilhado_id: number; quantidade_por_venda: number };
type Clima = { data: string; maxima: number | null; chuva: boolean };

function dia(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

async function consultarTudo<T>(
  consulta: (a: number, b: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  limite = 20000,
): Promise<T[]> {
  const lista: T[] = [];

  for (let i = 0; i < limite; i += 500) {
    const { data, error } = await consulta(i, i + 499);
    if (error) throw new Error("Historico incompleto.");
    lista.push(...(data ?? []));
    if ((data ?? []).length < 500) return lista;
  }

  throw new Error("Historico acima do limite seguro.");
}

async function consultarClima(): Promise<Clima[]> {
  try {
    // MET Norway: uso comercial permitido, com atribuicao.
    // Local aproximado: Nova Iguacu, RJ.
    const resposta = await fetch(
      "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=-22.76&lon=-43.45",
      {
        headers: {
          "User-Agent": "DepositoDoZe/1.0 (+https://deposito-do-ze.vercel.app)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(9000),
        next: { revalidate: 3600 },
      },
    );

    if (!resposta.ok) {
      console.warn("MET_NO_HTTP", resposta.status);
      return [];
    }

    type Ponto = {
      time: string;
      data: {
        instant?: {
          details?: { air_temperature?: number };
        };
        next_1_hours?: {
          details?: { precipitation_amount?: number };
          summary?: { symbol_code?: string };
        };
      };
    };

    const json = (await resposta.json()) as {
      properties?: { timeseries?: Ponto[] };
    };

    const pontos = json.properties?.timeseries ?? [];

    const dias = new Map<string, {
      data: string;
      maxima: number | null;
      chuva: boolean;
    }>();

    const hoje = dia(new Date().toISOString());

    for (const ponto of pontos) {
      if (!ponto?.time || !ponto.data) continue;

      const dataLocal = dia(ponto.time);
      if (dataLocal < hoje) continue;

      const temperatura = Number(
        ponto.data.instant?.details?.air_temperature,
      );

      const temperaturaValida =
        Number.isFinite(temperatura) &&
        temperatura >= 5 &&
        temperatura <= 50;

      const precipitacao = Number(
        ponto.data.next_1_hours?.details?.precipitation_amount ?? 0,
      );

      const simbolo =
        ponto.data.next_1_hours?.summary?.symbol_code ?? "";

      const chuva =
        precipitacao >= 0.8 ||
        /rain|thunder|sleet/i.test(simbolo);

      const atual = dias.get(dataLocal) ?? {
        data: dataLocal,
        maxima: null,
        chuva: false,
      };

      if (temperaturaValida) {
        atual.maxima = atual.maxima === null
          ? temperatura
          : Math.max(atual.maxima, temperatura);
      }

      atual.chuva = atual.chuva || chuva;
      dias.set(dataLocal, atual);
    }

    return [...dias.values()]
      .filter((d) => d.maxima !== null)
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(0, 7);
  } catch (erro) {
    console.warn("MET_NO_INDISPONIVEL", erro);
    return [];
  }
}

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ erro: "Nao autorizado." }, { status: 401 });
  }

  try {
    const inicio = new Date(Date.now() - 28 * 86400000).toISOString();

    const [produtosR, configR, estoquesR, categoriasR, clima] = await Promise.all([
      supabaseAdmin.from("produtos")
        .select("id,nome,estoque,categoria_id")
        .eq("ativo", true).order("id"),
      supabaseAdmin.from("produto_estoque_config")
        .select("produto_id,estoque_compartilhado_id,quantidade_por_venda"),
      supabaseAdmin.from("estoques_compartilhados")
        .select("id,quantidade_total"),
      supabaseAdmin.from("categorias").select("id,nome"),
      consultarClima(),
    ]);

    if ([produtosR, configR, estoquesR, categoriasR].some(r => r.error)) {
      throw new Error("Falha na consulta de produtos e estoques.");
    }

    const config = new Map(
      ((configR.data ?? []) as Config[]).map(c => [Number(c.produto_id), c]),
    );

    const saldos = new Map(
      (estoquesR.data ?? []).map(e => [Number(e.id), Number(e.quantidade_total)]),
    );

    const categorias = new Map(
      (categoriasR.data ?? []).map(c => [Number(c.id), String(c.nome)]),
    );

    type Grupo = {
      chave: string; nome: string; categoria: string;
      estoque: number | null; compartilhado: boolean;
      vendas28: number; vendas14: number;
      porDia: Record<string, number>;
    };

    const grupos = new Map<string, Grupo>();
    const chavePorProduto = new Map<number, string>();

    for (const produto of produtosR.data ?? []) {
      const c = config.get(Number(produto.id));
      const chave = c
        ? `fisico:${c.estoque_compartilhado_id}`
        : `produto:${produto.id}`;

      chavePorProduto.set(Number(produto.id), chave);

      if (!grupos.has(chave)) {
        grupos.set(chave, {
          chave,
          nome: c ? `Estoque compartilhado #${c.estoque_compartilhado_id}` : produto.nome,
          categoria: categorias.get(Number(produto.categoria_id)) ?? "Outros",
          estoque: c
            ? Number(saldos.get(Number(c.estoque_compartilhado_id)) ?? NaN)
            : Number(produto.estoque),
          compartilhado: Boolean(c),
          vendas28: 0,
          vendas14: 0,
          porDia: {},
        });
      }

      if (c) grupos.get(chave)!.nome += ` / ${produto.nome}`;
    }

    const [pedidos, vendas] = await Promise.all([
      consultarTudo<Registro>((a, b) =>
        supabaseAdmin.from("pedidos")
          .select("id,created_at,status")
          .gte("created_at", inicio).order("id").range(a, b)),
      consultarTudo<Registro>((a, b) =>
        supabaseAdmin.from("pdv_vendas")
          .select("id,created_at,status")
          .gte("created_at", inicio)
          .eq("status", "concluida").order("id").range(a, b)),
    ]);

    const movimentos: { produtoId: number; quantidade: number; data: string }[] = [];

    async function carregarItens(
      tabela: string,
      coluna: "pedido_id" | "venda_id",
      registros: Registro[],
    ) {
      for (let i = 0; i < registros.length; i += 50) {
        const lote = registros.slice(i, i + 50);
        const datas = new Map(lote.map(r => [r.id, r.created_at]));

        const itens = await consultarTudo<Item>((a, b) =>
          supabaseAdmin.from(tabela)
            .select(`${coluna},produto_id,quantidade`)
            .in(coluna, lote.map(r => r.id))
            .order(coluna).range(a, b), 10000);

        for (const item of itens) {
          const registro = datas.get(Number(item[coluna]));

          if (registro && Number(item.quantidade) > 0) {
            movimentos.push({
              produtoId: Number(item.produto_id),
              quantidade: Number(item.quantidade),
              data: dia(registro),
            });
          }
        }
      }
    }

    await Promise.all([
      carregarItens("itens_pedido", "pedido_id",
        pedidos.filter(p => p.status !== "cancelado")),
      carregarItens("pdv_venda_itens", "venda_id", vendas),
    ]);

    const inicioRecente = dia(new Date(Date.now() - 14 * 86400000).toISOString());

    for (const m of movimentos) {
      const chave = chavePorProduto.get(m.produtoId);
      if (!chave) continue;

      const grupo = grupos.get(chave)!;
      const unidade = m.quantidade *
        Number(config.get(m.produtoId)?.quantidade_por_venda ?? 1);

      if (!Number.isSafeInteger(unidade) || unidade <= 0) {
        throw new Error("Configuracao fisica de estoque invalida.");
      }

      grupo.vendas28 += unidade;
      if (m.data >= inicioRecente) grupo.vendas14 += unidade;
      grupo.porDia[m.data] = (grupo.porDia[m.data] ?? 0) + unidade;
    }

    const hoje = dia(new Date().toISOString());

    const proximosDias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${hoje}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i + 1);
      return d.toISOString().slice(0, 10);
    });

    const previsaoClima = new Map(clima.map(c => [c.data, c]));

    const itens = [...grupos.values()].map(grupo => {
      const base =
        (grupo.vendas14 / 14) * 0.7 +
        ((grupo.vendas28 - grupo.vendas14) / 14) * 0.3;

      const influenciaClima =
        /cerveja|refrigerante|água|agua|gelo|energ[eé]tico|chopp|bebida/i
          .test(`${grupo.nome} ${grupo.categoria}`);

      let previsao = 0;

      for (const data of proximosDias) {
        const diaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();

        const vendasMesmoDia = Object.entries(grupo.porDia)
          .filter(([dataVenda]) =>
            new Date(`${dataVenda}T12:00:00Z`).getUTCDay() === diaSemana)
          .reduce((total, [, quantidade]) => total + quantidade, 0) / 4;

        const fatorDia = base > 0
          ? Math.max(0.7, Math.min(1.35, 0.7 + (vendasMesmoDia / base) * 0.3))
          : 1;

        const tempo = previsaoClima.get(data);

        const fatorClima = !influenciaClima || !tempo
          ? 1
          : tempo.maxima !== null && tempo.maxima >= 32
            ? 1.15
            : tempo.chuva ? 0.92 : 1;

        previsao += base * fatorDia * fatorClima;
      }

      const estoque = grupo.estoque !== null &&
        Number.isFinite(grupo.estoque) && grupo.estoque >= 0
          ? grupo.estoque
          : null;

      const sugestao = estoque === null || grupo.vendas28 < 5 || pedidos.length + vendas.length < 10
        ? null
        : Math.max(0, Math.ceil(previsao * 1.2) - Math.floor(estoque));

      return {
        ...grupo,
        estoque,
        previsao: Math.round(previsao * 10) / 10,
        sugestao,
        motivo: estoque === null
          ? "Conferir estoque fisico"
          : grupo.vendas28 < 5 || pedidos.length + vendas.length < 10
            ? "Historico insuficiente: conferir manualmente"
            : (sugestao ?? 0) > 0
              ? "Reposicao sugerida"
              : "Estoque suficiente",
      };
    }).sort((a, b) => (b.sugestao ?? -1) - (a.sugestao ?? -1));

    return NextResponse.json({
      itens, clima, hoje,
      inicio: inicio.slice(0, 10),
      pedidos: pedidos.filter(p => p.status !== "cancelado").length,
      vendas: vendas.length,
      analiseIAHabilitada: Boolean(process.env.GROQ_API_KEY),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });

  } catch (error) {
    console.error("Consulta de compras incompleta:", error);

    return NextResponse.json({
      erro: "Nao foi possivel conferir todos os dados. Nenhuma sugestao foi gerada.",
    }, { status: 503 });
  }
}
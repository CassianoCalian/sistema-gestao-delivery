
import { supabaseAdmin } from "./supabaseAdmin";

type Venda = {
  id: number;
  created_at: string;
  total: number | string;
  status: string;
  forma_pagamento: string | null;
  pagamentos_detalhes: unknown;
};

type Periodos = {
  inicioHoje: Date;
  fimHoje: Date;
  inicioUltimos7Dias: Date;
  inicio7DiasAnteriores: Date;
  inicioMesAtual: Date;
  inicioMesAnterior: Date;
};

type Linha = {
  id: number;
  created_at: string;
  total: number;
  status: string;
  forma_pagamento: string;
  bairro: string | null;
  pagamentos_detalhes: unknown;
};

export async function carregarBalcaoDashboard(p: Periodos) {
  const inicial = new Date(Math.min(
    p.inicio7DiasAnteriores.getTime(),
    p.inicioMesAnterior.getTime()
  ));

  const vendas: Venda[] = [];

  for (let pagina = 0; pagina < 100; pagina++) {
    const inicio = pagina * 500;

    const { data, error } = await supabaseAdmin
      .from("pdv_vendas")
      .select("id,created_at,total,status,forma_pagamento,pagamentos_detalhes")
      .gte("created_at", inicial.toISOString())
      .lt("created_at", p.fimHoje.toISOString())
      .in("status", ["concluida", "cancelada", "cancelado"])
      .order("id", { ascending: true })
      .range(inicio, inicio + 499);

    if (error) {
      throw Error("Consulta do balcao: " + error.message);
    }

    const lote = (data ?? []) as Venda[];
    vendas.push(...lote);

    if (lote.length < 500) break;

    if (pagina === 99) {
      throw Error("Limite de vendas excedido.");
    }
  }

  const linhas: Linha[] = vendas.map((v) => ({
    id: -Number(v.id),
    created_at: v.created_at,
    total: Number(v.total),
    status: v.status === "concluida" ? "entregue" : "cancelado",
    forma_pagamento: v.forma_pagamento ?? "",
    bairro: null,
    pagamentos_detalhes: v.pagamentos_detalhes
  }));

  const entre = (inicio: Date, fim: Date) =>
    linhas.filter((v) => {
      const data = new Date(v.created_at).getTime();
      return data >= inicio.getTime() && data < fim.getTime();
    });

  return {
    hoje: entre(p.inicioHoje, p.fimHoje),
    ultimos7: entre(p.inicioUltimos7Dias, p.fimHoje),
    anteriores7: entre(
      p.inicio7DiasAnteriores, p.inicioUltimos7Dias
    ),
    mesAtual: entre(p.inicioMesAtual, p.fimHoje),
    mesAnterior: entre(p.inicioMesAnterior, p.inicioMesAtual)
  };
}

export async function buscarItensBalcaoDashboard(
  idsVendas: number[],
  catalogo: Array<{ id: number; nome: string }>
): Promise<Array<{
  produto_id: number;
  nome_produto: string;
  quantidade: number;
}>> {
  if (!idsVendas.length) return [];

  const nomes = new Map(
    catalogo.map((p) => [Number(p.id), p.nome])
  );

  const resultado: Array<{
    produto_id: number;
    nome_produto: string;
    quantidade: number;
  }> = [];

  for (let bloco = 0; bloco < idsVendas.length; bloco += 80) {
    const ids = idsVendas.slice(bloco, bloco + 80);

    for (let pagina = 0; pagina < 100; pagina++) {
      const inicio = pagina * 500;

      const { data, error } = await supabaseAdmin
        .from("pdv_venda_itens")
        .select("*")
        .in("venda_id", ids)
        .order("id", { ascending: true })
        .range(inicio, inicio + 499);

      if (error) {
        throw Error("Itens do balcao: " + error.message);
      }

      const lote = (data ?? []) as Array<Record<string, unknown>>;

      for (const item of lote) {
        const id = Number(
          item.produto_id ?? item.id_produto
        );

        const quantidade = Number(item.quantidade);

        if (
          !Number.isSafeInteger(id) || id <= 0 ||
          !Number.isFinite(quantidade) || quantidade <= 0
        ) {
          throw Error("Item de balcao invalido.");
        }

        const nome = String(
          item.nome_produto ??
          item.produto_nome ??
          nomes.get(id) ??
          ("Produto " + id)
        );

        resultado.push({
          produto_id: id,
          nome_produto: nome,
          quantidade
        });
      }

      if (lote.length < 500) break;

      if (pagina === 99) {
        throw Error("Limite de itens excedido.");
      }
    }
  }

  return resultado;
}

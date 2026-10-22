import { supabaseAdmin } from "./supabaseAdmin";

export type VendaPagamento = {
  id: number;
  total: number | string;
  forma_pagamento: string | null;
  pagamentos_detalhes?: unknown;
  turno_id?: number | null;
};

type Forma = "dinheiro" | "pix" | "debito" | "credito" | "cartao_entrega";

function centavos(v: unknown): number {
  const n = Number(v);
  if (
    !Number.isFinite(n) ||
    n < 0 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.001
  ) {
    throw Error("Valor financeiro invalido");
  }
  return Math.round(n * 100);
}

export function resumoPagamentos(vendas: VendaPagamento[]) {
  const valores: Record<Forma, number> = {
    dinheiro: 0, pix: 0, debito: 0,
    credito: 0, cartao_entrega: 0
  };

  const contagens: Record<Forma, number> = {
    dinheiro: 0, pix: 0, debito: 0,
    credito: 0, cartao_entrega: 0
  };

  let geral = 0;

  for (const venda of vendas) {
    const detalhes = venda.pagamentos_detalhes;

    let parcelas: Array<{ forma: string; valor: number | string }>;

    if (detalhes === null || detalhes === undefined) {
      parcelas = [{
        forma: venda.forma_pagamento ?? "",
        valor: venda.total
      }];
    } else {
      const obj = detalhes as {
        parcelas?: Array<{ forma: string; valor: number }>
      };

      if (
        typeof obj !== "object" ||
        Array.isArray(obj) ||
        !Array.isArray(obj.parcelas) ||
        obj.parcelas.length < 1 ||
        obj.parcelas.length > 2
      ) {
        throw Error("Parcelas invalidas na venda " + venda.id);
      }

      parcelas = obj.parcelas;
    }

    let soma = 0;
    const usadas = new Set<string>();

    for (const p of parcelas) {
      const f = p.forma as Forma;

      if (!(f in valores) || usadas.has(f)) {
        throw Error("Forma invalida na venda " + venda.id);
      }

      usadas.add(f);

      const valor = centavos(p.valor);

      if (valor <= 0 && parcelas.length > 1) {
        throw Error("Parcela zerada na venda " + venda.id);
      }

      valores[f] += valor;
      contagens[f]++;
      soma += valor;
    }

    const total = centavos(venda.total);

    if (soma !== total) {
      throw Error("Total divergente na venda " + venda.id);
    }

    geral += total;
  }

  return {
    quantidade: vendas.length,
    total: geral / 100,
    totais: {
      dinheiro: valores.dinheiro / 100,
      pix: valores.pix / 100,
      debito: valores.debito / 100,
      credito: valores.credito / 100,
      cartao_entrega: valores.cartao_entrega / 100
    },
    contagens
  };
}

export function descricaoPagamento(v: VendaPagamento) {
  const obj = v.pagamentos_detalhes as {
    parcelas?: Array<{ forma: string; valor: number }>
  } | null;

  if (!obj || !Array.isArray(obj.parcelas)) {
    return v.forma_pagamento ?? "Nao informado";
  }

  return obj.parcelas.map(p =>
    p.forma.toUpperCase() + " " +
    Number(p.valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    })
  ).join(" + ");
}

export async function vendasPorTurnos(ids: number[]) {
  if (!ids.length) return [] as VendaPagamento[];

  const todas: VendaPagamento[] = [];
  const limite = 1000;

  for (let inicio = 0; inicio < 50000; inicio += limite) {
    const { data, error } = await supabaseAdmin
      .from("pdv_vendas")
      .select(
        "id,turno_id,total,forma_pagamento,pagamentos_detalhes"
      )
      .in("turno_id", ids)
      .eq("status", "concluida")
      .order("id", { ascending: true })
      .range(inicio, inicio + limite - 1);

    if (error) throw Error(error.message);

    const lote = (data ?? []) as VendaPagamento[];
    todas.push(...lote);

    if (lote.length < limite) return todas;
  }

  throw Error("Limite de vendas excedido. Confira os turnos.");
}

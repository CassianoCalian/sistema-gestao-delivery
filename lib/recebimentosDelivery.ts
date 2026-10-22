
export type PedidoDeliveryFinanceiro = {
  id: number;
  total: number | string;
  forma_pagamento: string | null;
  pagamento_confirmado: boolean | null;
  status?: string | null;
  pagamentos_detalhes?: unknown;
};

type Forma =
  | "pix"
  | "dinheiro"
  | "debito"
  | "credito"
  | "cartao_entrega";

const FORMAS: Forma[] = [
  "pix", "dinheiro", "debito",
  "credito", "cartao_entrega"
];

function centavos(valor: unknown): number {
  const n = Number(valor);

  if (
    !Number.isFinite(n) ||
    n < 0 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.001
  ) {
    throw Error("Valor financeiro invalido no delivery.");
  }

  return Math.round(n * 100);
}

function analisarPedido(pedido: PedidoDeliveryFinanceiro) {
  const total = centavos(pedido.total);
  const recebidas: { forma: Forma; valor: number }[] = [];

  const detalhes = pedido.pagamentos_detalhes;

  if (
    detalhes &&
    typeof detalhes === "object" &&
    "parcelas" in detalhes
  ) {
    const parcelas =
      (detalhes as { parcelas?: unknown }).parcelas;

    if (
      !Array.isArray(parcelas) ||
      parcelas.length < 1 ||
      parcelas.length > 2
    ) {
      throw Error("Parcelas invalidas: pedido " + pedido.id);
    }

    let soma = 0;
    const usadas = new Set<string>();

    for (const parcela of parcelas) {
      if (!parcela || typeof parcela !== "object") {
        throw Error("Parcela invalida: pedido " + pedido.id);
      }

      const p = parcela as {
        forma?: string;
        valor?: unknown;
        recebido?: unknown;
      };

      if (
        !FORMAS.includes(p.forma as Forma) ||
        usadas.has(String(p.forma)) ||
        (
          p.recebido !== undefined &&
          typeof p.recebido !== "boolean"
        )
      ) {
        throw Error("Pagamento invalido: pedido " + pedido.id);
      }

      usadas.add(String(p.forma));

      const valor = centavos(p.valor);

      if (valor <= 0) {
        throw Error("Parcela zerada: pedido " + pedido.id);
      }

      soma += valor;

      if (
        pedido.pagamento_confirmado === true ||
        p.recebido === true
      ) {
        recebidas.push({
          forma: p.forma as Forma,
          valor
        });
      }
    }

    if (soma !== total) {
      throw Error("Soma divergente: pedido " + pedido.id);
    }

  } else if (pedido.pagamento_confirmado === true) {
    const forma = pedido.forma_pagamento as Forma;

    if (!FORMAS.includes(forma)) {
      throw Error("Forma desconhecida: pedido " + pedido.id);
    }

    recebidas.push({ forma, valor: total });
  }

  const recebido = recebidas.reduce(
    (soma, p) => soma + p.valor, 0
  );

  if (recebido > total) {
    throw Error("Recebido excede total: pedido " + pedido.id);
  }

  return {
    total,
    recebido,
    pendente: total - recebido,
    recebidas
  };
}

export function resumirRecebimentosDelivery(
  pedidos: PedidoDeliveryFinanceiro[]
) {
  const valores: Record<Forma, number> = {
    pix: 0,
    dinheiro: 0,
    debito: 0,
    credito: 0,
    cartao_entrega: 0
  };

  let vendido = 0;
  let recebido = 0;
  let pendente = 0;

  for (const pedido of pedidos) {
    if (pedido.status === "cancelado") continue;

    const dados = analisarPedido(pedido);

    vendido += dados.total;
    recebido += dados.recebido;
    pendente += dados.pendente;

    for (const p of dados.recebidas) {
      valores[p.forma] += p.valor;
    }
  }

  if (recebido + pendente !== vendido) {
    throw Error("Resumo financeiro divergente.");
  }

  return {
    vendido: vendido / 100,
    recebido: recebido / 100,
    pendente: pendente / 100,
    totais: {
      pix: valores.pix / 100,
      dinheiro: valores.dinheiro / 100,
      debito: valores.debito / 100,
      credito: valores.credito / 100,
      cartao_entrega: valores.cartao_entrega / 100
    }
  };
}

export function situacaoRecebimentoDelivery(
  pedido: PedidoDeliveryFinanceiro
) {
  if (pedido.status === "cancelado") {
    return "Cancelado";
  }

  const dados = analisarPedido(pedido);

  if (dados.pendente === 0) {
    return "Pagamento confirmado";
  }

  if (dados.recebido > 0) {
    return "Pagamento parcial - saldo a receber";
  }

  return "Pagamento pendente";
}

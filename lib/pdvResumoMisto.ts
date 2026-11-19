import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { resumirRecebimentosDelivery } from "./recebimentosDelivery";

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


// Consolida o dinheiro recebido ao confirmar pagamento de um pedido.
// Usa o "suprimento" já existente: não cria tabelas, campos ou elementos visuais.
// Não infere recebimento pelo status "entregue" ou pela data da venda.
export async function conciliarDinheiroDeliveryNoCaixa(
  pedidoId: number,
  operador: { id: string; email?: string }
): Promise<void> {
  if (!Number.isSafeInteger(pedidoId) || pedidoId <= 0 || !operador.email) {
    throw Error("Identificacao invalida para conciliar o caixa.");
  }

  const { data: pedido, error: erroPedido } = await supabaseAdmin
    .from("pedidos")
    .select("id,total,status,forma_pagamento,pagamento_confirmado,pagamentos_detalhes")
    .eq("id", pedidoId)
    .maybeSingle();

  if (erroPedido || !pedido) {
    throw Error("Nao foi possivel conferir o recebimento do pedido.");
  }

  const dinheiroConfirmado = centavos(
    resumirRecebimentosDelivery([pedido]).totais.dinheiro
  );

  // A ausência de dinheiro confirmado não altera a gaveta.
  if (dinheiroConfirmado === 0) return;

  // Consulta o histórico inteiro (inclusive o registro manual que existiu
  // temporariamente no Controle de Caixa) para não somar um mesmo pedido duas vezes.
  const { data: existentes, error: erroMovimentos } = await supabaseAdmin
    .from("pdv_caixa_movimentacoes")
    .select("id,tipo,valor,motivo")
    .ilike("motivo", `%pedido #${pedidoId}%`)
    .order("id", { ascending: true })
    .limit(1000);

  if (erroMovimentos || !existentes || existentes.length === 1000) {
    throw Error("Nao foi possivel conferir os lancamentos anteriores.");
  }

  const corresponde = new RegExp(`pedido #${pedidoId}(?!\\d)`, "i");
  const jaRegistrado = existentes
    .filter((m) => typeof m.motivo === "string" && corresponde.test(m.motivo))
    .reduce(
      (soma, m) =>
        soma + (m.tipo === "suprimento" ? centavos(m.valor) : -centavos(m.valor)),
      0
    );

  const diferenca = dinheiroConfirmado - jaRegistrado;
  if (diferenca === 0) return;

  // Nunca cria sangria automática: uma alteração de pagamento não prova
  // que houve saída física de dinheiro da gaveta.
  if (diferenca < 0) {
    throw Error("O dinheiro registrado excede o confirmado. Confira o pedido e o caixa.");
  }

  const { data: caixa, error: erroCaixa } = await supabaseAdmin
    .from("pdv_caixas")
    .select("id")
    .eq("codigo", "principal")
    .maybeSingle();

  if (erroCaixa || !caixa) {
    throw Error("Caixa principal indisponivel.");
  }

  const { data: turno, error: erroTurno } = await supabaseAdmin
    .from("pdv_turnos")
    .select("id")
    .eq("caixa_id", caixa.id)
    .eq("status", "aberto")
    .maybeSingle();

  if (erroTurno || !turno) {
    throw Error("Nao ha turno aberto para registrar o dinheiro confirmado.");
  }

  // A chave depende do pedido e do total confirmado.
  // Reenvios e confirmações concorrentes do mesmo valor não geram duplicata.
  const hash = createHash("sha256")
    .update(`ze:delivery-confirmado:${pedidoId}:${dinheiroConfirmado}`)
    .digest("hex");
  const chave =
    `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}` +
    `-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

  const { error } = await supabaseAdmin.rpc("movimentar_caixa_pdv", {
    p_turno_id: turno.id,
    p_tipo: "suprimento",
    p_valor: diferenca / 100,
    p_motivo: `Dinheiro de delivery confirmado - pedido #${pedidoId}`,
    p_operador_uid: operador.id,
    p_operador_email: operador.email,
    p_chave: chave,
  });

  if (error) {
    throw Error(
      "Dinheiro confirmado no pedido, mas nao conciliado no caixa. " +
      "Confira o turno antes de repetir a confirmacao."
    );
  }
}

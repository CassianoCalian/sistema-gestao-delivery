import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = {
  id: number;
  quantidade: number;
  opcoes_selecionadas?: {
    opcao_id: number;
    quantidade: number;
  }[];
};

type Corpo = {
  nome?: string;
  telefone?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  referencia?: string;
  forma_pagamento?: string;
  troco_para?: number | null;
  itens?: Item[];
  chave_idempotencia?: string;
};

function erro(mensagem: string, status = 400) {
  return NextResponse.json(
    { erro: mensagem },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function campo(valor: unknown) {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizar(valor: string) {
  return valor.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();
}

export async function POST(request: Request) {
  let operador: Awaited<ReturnType<typeof requireAdmin>>;

  try {
    operador = await requireAdmin();
  } catch {
    return erro("Nao autorizado.", 401);
  }

  if (!operador.email) return erro("Operador invalido.", 403);

  try {
    const body = (await request.json()) as Corpo;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return erro("Dados invalidos.");
    }

    const nome = campo(body.nome);
    const telefone = campo(body.telefone);
    const cepOriginal = campo(body.cep);
    const cep = cepOriginal.replace(/\D/g, "");
    const rua = campo(body.rua);
    const numero = campo(body.numero);
    const bairro = campo(body.bairro);
    const pagamento = campo(body.forma_pagamento);
    const chave = campo(body.chave_idempotencia);

    if (!nome || !telefone) {
      return erro("Informe o cliente e telefone.");
    }

    if (!rua || !numero || !bairro) {
      return erro("Informe rua, numero e bairro.");
    }

    if (cepOriginal && !/^\d{8}$/.test(cep)) {
      return erro("CEP deve ter 8 numeros ou ficar vazio.");
    }

    const bairrosPermitidos = [
      "jardim pernambuco",
      "jardim nova era"
    ];

    if (!bairrosPermitidos.includes(normalizar(bairro))) {
      return erro(
        "Bairro fora da area habitual. Consulte o atendimento antes de registrar."
      );
    }

    if (!["pix", "dinheiro", "cartao_entrega"].includes(pagamento)) {
      return erro("Pagamento invalido.");
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(chave)) {
      return erro("Identificador do pedido invalido.");
    }

    if (!Array.isArray(body.itens) ||
        body.itens.length === 0 || body.itens.length > 100) {
      return erro("Carrinho invalido.");
    }

    const ids = new Set<number>();

    for (const item of body.itens) {
      if (!item ||
          !Number.isSafeInteger(item.id) || item.id <= 0 ||
          ids.has(item.id) ||
          !Number.isInteger(item.quantidade) ||
          item.quantidade <= 0 || item.quantidade > 999) {
        return erro("Produtos ou quantidades invalidos.");
      }

      ids.add(item.id);
      const opcoes = item.opcoes_selecionadas ?? [];

      if (!Array.isArray(opcoes) || opcoes.length > 100 ||
          opcoes.some(o =>
            !o || !Number.isSafeInteger(o.opcao_id) ||
            o.opcao_id <= 0 || !Number.isInteger(o.quantidade) ||
            o.quantidade <= 0 || o.quantidade > 999
          )) {
        return erro("Opcoes de produtos invalidas.");
      }
    }

    const troco =
      pagamento === "dinheiro" && body.troco_para != null
        ? Number(body.troco_para)
        : null;

    if (troco !== null && (!Number.isFinite(troco) || troco <= 0)) {
      return erro("Valor de troco invalido.");
    }

    const { data, error } = await supabaseAdmin.rpc(
      "criar_pedido_pdv_entrega",
      {
        p_nome: nome,
        p_telefone: telefone,
        p_cep: cep,
        p_rua: rua,
        p_numero: numero,
        p_complemento: campo(body.complemento) || null,
        p_bairro: bairro,
        p_referencia: campo(body.referencia) || null,
        p_forma_pagamento: pagamento,
        p_troco_para: troco,
        p_itens: body.itens,
        p_chave_idempotencia: chave
      }
    );

    if (error) {
      console.error("Erro na entrega PDV:", error);

      if (error.message?.includes("ESTOQUE")) {
        return erro("Estoque insuficiente. Atualize o PDV.", 409);
      }
      if (error.message?.includes("PEDIDO_MINIMO")) {
        return erro("A regra de pedido minimo ainda esta ativa.", 409);
      }
      if (error.code === "PGRST202") {
        return erro("Atualizacao SQL pendente no Supabase.", 503);
      }
      return erro(
        "Nao foi possivel registrar a entrega. Confira o historico antes de tentar novamente.",
        500
      );
    }

    const resultado = Array.isArray(data) ? data[0] : data;

    if (!resultado?.pedido_id) {
      return erro("Pedido nao confirmado pelo banco.", 500);
    }

    return NextResponse.json(
      {
        sucesso: true,
        pedido_id: resultado.pedido_id,
        codigo_acesso: resultado.codigo_acesso,
        subtotal: Number(resultado.subtotal),
        taxa_entrega: Number(resultado.taxa_entrega),
        total: Number(resultado.total)
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );

  } catch (e) {
    console.error("Erro no PDV Delivery:", e);
    return erro("Erro interno ao registrar entrega.", 500);
  }
}
import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

function normalizarTelefone(valor: string) {
  let numeros = valor.replace(/\D/g, "");

  if (
    (numeros.length === 12 || numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    numeros = numeros.slice(2);
  }

  return numeros;
}

function normalizarNumeroEndereco(valor: string) {
  return valor.trim().toLowerCase().replace(/\s+/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const telefone = typeof body?.telefone === "string" ? body.telefone : "";

    const numeroConfirmacao =
      typeof body?.numero_confirmacao === "string"
        ? body.numero_confirmacao
        : "";

    const telefoneNormalizado = normalizarTelefone(telefone);

    if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
      return NextResponse.json(
        {
          erro: "Informe um telefone válido.",
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================
    // 1. PROCURA O CLIENTE
    // ==========================================

    const { data: cliente, error: erroCliente } = await supabaseAdmin
      .from("clientes")
      .select(
        `
          id,
          nome,
          telefone
        `,
      )
      .eq("telefone_normalizado", telefoneNormalizado)
      .maybeSingle();

    if (erroCliente) {
      console.error("Erro ao procurar cliente:", erroCliente);

      return NextResponse.json(
        {
          erro: "Não foi possível consultar o cadastro.",
        },
        {
          status: 500,
        },
      );
    }

    if (!cliente) {
      return NextResponse.json({
        encontrado: false,
        verificado: false,
      });
    }

    // ==========================================
    // 2. BUSCA O ÚLTIMO PEDIDO
    // ==========================================

    const { data: ultimoPedido, error: erroPedido } = await supabaseAdmin
      .from("pedidos")
      .select(
        `
          nome_cliente,
          telefone,
          cep,
          rua,
          numero,
          complemento,
          bairro,
          referencia,
          forma_pagamento,
          created_at
        `,
      )
      .eq("cliente_id", cliente.id)
      .neq("status", "cancelado")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (erroPedido) {
      console.error("Erro ao procurar último pedido:", erroPedido);

      return NextResponse.json(
        {
          erro: "Não foi possível consultar o último pedido.",
        },
        {
          status: 500,
        },
      );
    }

    if (!ultimoPedido) {
      return NextResponse.json({
        encontrado: true,
        possui_endereco: false,
        verificado: false,
      });
    }

    // ==========================================
    // 3. PRIMEIRA CONSULTA
    // NÃO ENTREGA ENDEREÇO AINDA
    // ==========================================

    if (!numeroConfirmacao.trim()) {
      return NextResponse.json({
        encontrado: true,
        possui_endereco: true,
        verificado: false,
        precisa_confirmar: true,
      });
    }

    // ==========================================
    // 4. CONFIRMA NÚMERO DA RESIDÊNCIA
    // ==========================================

    const numeroInformado = normalizarNumeroEndereco(numeroConfirmacao);

    const numeroSalvo = normalizarNumeroEndereco(
      String(ultimoPedido.numero ?? ""),
    );

    if (!numeroSalvo || numeroInformado !== numeroSalvo) {
      return NextResponse.json({
        encontrado: true,
        possui_endereco: true,
        verificado: false,
        confirmacao_incorreta: true,
      });
    }

    // ==========================================
    // 5. CLIENTE CONFIRMADO
    // ==========================================

    return NextResponse.json({
      encontrado: true,
      possui_endereco: true,
      verificado: true,

      dados: {
        nome: ultimoPedido.nome_cliente ?? cliente.nome ?? "",

        telefone: ultimoPedido.telefone ?? cliente.telefone ?? telefone,

        cep: ultimoPedido.cep ?? "",

        rua: ultimoPedido.rua ?? "",

        numero: ultimoPedido.numero ?? "",

        complemento: ultimoPedido.complemento ?? "",

        bairro: ultimoPedido.bairro ?? "",

        referencia: ultimoPedido.referencia ?? "",

        forma_pagamento: ultimoPedido.forma_pagamento ?? null,
      },
    });
  } catch (error) {
    console.error("Erro na consulta do cliente:", error);

    return NextResponse.json(
      {
        erro: "Erro interno ao consultar cliente.",
      },
      {
        status: 500,
      },
    );
  }
}

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

    // Primeiro utiliza o pedido associado ao cadastro.
    // Se ele nao tiver endereco, procura pedidos antigos
    // pelo telefone, mesmo sem cliente_id associado.
    let pedidoParaConfirmacao = ultimoPedido;

    const enderecoCompleto = (registro: typeof ultimoPedido) =>
      Boolean(
        registro?.cep &&
          registro?.rua &&
          registro?.numero &&
          registro?.bairro,
      );

    if (!enderecoCompleto(pedidoParaConfirmacao)) {
      const ultimosQuatro = telefoneNormalizado.slice(-4);

      const { data: pedidosPorTelefone, error: erroBuscaTelefone } =
        await supabaseAdmin
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
              created_at,
              status
            `,
          )
          .ilike("telefone", `%${ultimosQuatro}%`)
          .order("created_at", { ascending: false })
          .limit(200);

      if (erroBuscaTelefone) {
        console.error(
          "Erro ao procurar pedidos antigos:",
          erroBuscaTelefone,
        );

        return NextResponse.json(
          { erro: "Nao foi possivel consultar o historico." },
          { status: 500 },
        );
      }

      pedidoParaConfirmacao =
        (pedidosPorTelefone ?? []).find(
          (registro) =>
            registro.status !== "cancelado" &&
            normalizarTelefone(String(registro.telefone ?? "")) ===
              telefoneNormalizado &&
            enderecoCompleto(registro),
        ) ?? null;
    }

    // Recupera enderecos de pedidos reais cancelados
    // somente se nao houver pedido ativo com endereco.
    // Os dados continuam protegidos pela confirmacao
    // do numero da residencia antes de serem retornados.
    if (!pedidoParaConfirmacao) {
      const {
        data: historicoCancelado,
        error: erroHistoricoCancelado,
      } = await supabaseAdmin
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
        .eq("status", "cancelado")
        .order("created_at", { ascending: false })
        .limit(50);

      if (erroHistoricoCancelado) {
        console.error(
          "Erro ao consultar historico de enderecos:",
          erroHistoricoCancelado,
        );

        return NextResponse.json(
          { erro: "Nao foi possivel consultar o historico." },
          { status: 500 },
        );
      }

      pedidoParaConfirmacao =
        (historicoCancelado ?? []).find(enderecoCompleto) ?? null;
    }
    if (!pedidoParaConfirmacao) {
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
      String(pedidoParaConfirmacao.numero ?? ""),
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
        nome: pedidoParaConfirmacao.nome_cliente ?? cliente.nome ?? "",

        telefone: pedidoParaConfirmacao.telefone ?? cliente.telefone ?? telefone,

        cep: pedidoParaConfirmacao.cep ?? "",

        rua: pedidoParaConfirmacao.rua ?? "",

        numero: pedidoParaConfirmacao.numero ?? "",

        complemento: pedidoParaConfirmacao.complemento ?? "",

        bairro: pedidoParaConfirmacao.bairro ?? "",

        referencia: pedidoParaConfirmacao.referencia ?? "",

        forma_pagamento: pedidoParaConfirmacao.forma_pagamento ?? null,
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

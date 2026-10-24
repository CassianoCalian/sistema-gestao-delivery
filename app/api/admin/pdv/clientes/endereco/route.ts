import { NextResponse } from "next/server";

import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { requireAdmin } from "../../../../../../lib/supabase/requireAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PedidoEndereco = {
  cep: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  referencia: string | null;
  telefone: string | null;
  status: string | null;
};

function normalizarTelefone(valor: string) {
  const numeros = valor.replace(/\D/g, "");

  if (
    (numeros.length === 12 || numeros.length === 13) &&
    numeros.startsWith("55")
  ) {
    return numeros.slice(2);
  }

  return numeros;
}

function possuiEndereco(pedido: PedidoEndereco) {
  return Boolean(
    pedido.rua?.trim() &&
    pedido.numero?.trim()
  );
}

function escolherEndereco(pedidos: PedidoEndereco[]) {
  return (
    pedidos.find(
      (pedido) =>
        pedido.status !== "cancelado" && possuiEndereco(pedido),
    ) ??
    pedidos.find(possuiEndereco) ??
    null
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { erro: "Nao autorizado." },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const clienteId = Number(url.searchParams.get("cliente_id"));

    if (!Number.isSafeInteger(clienteId) || clienteId <= 0) {
      return NextResponse.json(
        { erro: "Cliente invalido." },
        { status: 400 },
      );
    }

    const { data: cliente, error: erroCliente } =
      await supabaseAdmin
        .from("clientes")
        .select("id, telefone, telefone_normalizado")
        .eq("id", clienteId)
        .maybeSingle();

    if (erroCliente) {
      throw new Error("Consulta de cliente indisponivel.");
    }

    if (!cliente) {
      return NextResponse.json(
        { erro: "Cliente nao encontrado." },
        { status: 404 },
      );
    }

    const colunas = `
      cep,
      rua,
      numero,
      bairro,
      complemento,
      referencia,
      telefone,
      status
    `;

    const { data: pedidos, error: erroPedidos } =
      await supabaseAdmin
        .from("pedidos")
        .select(colunas)
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(80);

    if (erroPedidos) {
      throw new Error("Consulta de pedidos indisponivel.");
    }

    let encontrado = escolherEndereco(
      (pedidos ?? []) as PedidoEndereco[],
    );

    // Pedidos antigos podem nao ter cliente_id associado.
    // Busca historico pelo telefone, exigindo correspondencia
    // exata apos normalizacao. Nunca utiliza apenas os 4
    // ultimos digitos como prova de identidade.

    if (!encontrado) {
      const telefone = normalizarTelefone(
        cliente.telefone_normalizado ?? cliente.telefone ?? "",
      );

      if (telefone.length >= 10 && telefone.length <= 11) {
        const finalQuatro = telefone.slice(-4);

        const { data: antigos, error: erroAntigos } =
          await supabaseAdmin
            .from("pedidos")
            .select(colunas)
            .ilike("telefone", `%${finalQuatro}%`)
            .order("created_at", { ascending: false })
            .limit(200);

        if (erroAntigos) {
          throw new Error("Consulta do historico indisponivel.");
        }

        const correspondentes = (
          (antigos ?? []) as PedidoEndereco[]
        ).filter(
          (pedido) =>
            normalizarTelefone(pedido.telefone ?? "") === telefone,
        );

        encontrado = escolherEndereco(correspondentes);
      }
    }

    const headers = {
      "Cache-Control": "private, no-store",
    };

    if (!encontrado) {
      return NextResponse.json(
        { encontrado: false },
        { headers },
      );
    }

    return NextResponse.json(
      {
        encontrado: true,
        endereco: {
          cep: encontrado.cep ?? "",
          rua: encontrado.rua ?? "",
          numero: encontrado.numero ?? "",
          bairro: encontrado.bairro ?? "",
          complemento: encontrado.complemento ?? "",
          referencia: encontrado.referencia ?? "",
        },
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { erro: "Nao foi possivel consultar o endereco." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

function criarSufixoAleatorio() {
  return randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
}

function normalizarNomeCupom(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
}

export async function gerarCupomReativacao(formData: FormData) {
  const clienteId = Number(formData.get("cliente_id"));

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    throw new Error("Cliente inválido.");
  }

  const agora = new Date();

  // ---------------------------------------------------------
  // 1. Confirma se o cliente existe
  // ---------------------------------------------------------

  const { data: cliente, error: erroCliente } = await supabaseAdmin
    .from("clientes")
    .select("id, nome")
    .eq("id", clienteId)
    .maybeSingle();

  if (erroCliente || !cliente) {
    throw new Error("Cliente não encontrado.");
  }

  // ---------------------------------------------------------
  // 2. Confirma se realmente está elegível para reativação
  //    Último pedido válido precisa ter 30 dias ou mais.
  // ---------------------------------------------------------

  const { data: ultimoPedido, error: erroUltimoPedido } = await supabaseAdmin
    .from("pedidos")
    .select("created_at")
    .eq("cliente_id", clienteId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroUltimoPedido) {
    throw new Error("Não foi possível verificar o histórico do cliente.");
  }

  if (!ultimoPedido) {
    throw new Error("Cliente sem compras válidas para reativação.");
  }

  const ultimaCompra = new Date(ultimoPedido.created_at);

  const diasSemComprar = Math.floor(
    (agora.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diasSemComprar < 30) {
    throw new Error("Este cliente ainda não atingiu 30 dias sem comprar.");
  }

  // ---------------------------------------------------------
  // 3. Desativa cupons de reativação que já venceram
  // ---------------------------------------------------------

  const { error: erroExpirados } = await supabaseAdmin
    .from("cupons")
    .update({
      ativo: false,
    })
    .eq("cliente_id", clienteId)
    .eq("motivo", "reativacao")
    .eq("ativo", true)
    .is("usado_em", null)
    .lte("valido_ate", agora.toISOString());

  if (erroExpirados) {
    throw new Error("Não foi possível atualizar os cupons antigos.");
  }

  // ---------------------------------------------------------
  // 4. Evita gerar vários cupons válidos para o mesmo cliente
  // ---------------------------------------------------------

  const { data: cupomExistente, error: erroCupomExistente } =
    await supabaseAdmin
      .from("cupons")
      .select("id, codigo, valido_ate")
      .eq("cliente_id", clienteId)
      .eq("motivo", "reativacao")
      .eq("ativo", true)
      .is("usado_em", null)
      .gt("valido_ate", agora.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (erroCupomExistente) {
    throw new Error("Não foi possível verificar os cupons existentes.");
  }

  if (cupomExistente) {
    revalidatePath("/admin/clientes");
    return;
  }

  // ---------------------------------------------------------
  // 5. Gera código personalizado
  // ---------------------------------------------------------

  const primeiroNome = cliente.nome.trim().split(/\s+/)[0] || "CLIENTE";

  const nomeCupom = normalizarNomeCupom(primeiroNome) || "CLIENTE";

  const codigo = `VOLTA-${nomeCupom}-${criarSufixoAleatorio()}`;

  const validoAte = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ---------------------------------------------------------
  // 6. Cria o cupom
  // ---------------------------------------------------------

  const { error: erroCriacao } = await supabaseAdmin.from("cupons").insert({
    cliente_id: clienteId,
    codigo,
    tipo: "percentual",
    percentual: 5,
    desconto_maximo: 10,
    valor_minimo_pedido: 30,
    motivo: "reativacao",
    valido_ate: validoAte.toISOString(),
    ativo: true,
  });

  if (erroCriacao) {
    console.error("Erro ao gerar cupom de reativação:", erroCriacao);

    throw new Error("Não foi possível gerar o cupom.");
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
}

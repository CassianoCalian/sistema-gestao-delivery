import { redirect } from "next/navigation";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { verificarAdmin } from "../../../lib/supabase/requireAdmin";
import PdvClient from "../../../components/pdv/PdvClient";
import AdminOrderAlerts from "../../../components/AdminOrderAlerts";

import Link from "next/link";

export const dynamic = "force-dynamic";

export type PdvOpcaoProduto = {
  id: number;
  nome: string;
  ativo: boolean;
  ordem: number;
};

export type PdvProduto = {
  id: number;
  nome: string;
  preco: number;
  preco_promocional: number | null;
  em_promocao: boolean;
  estoque: number;
  ativo: boolean;
  categoria_id: number | null;
  imagem_url: string | null;
  codigo_barras: string | null;
  unidades_por_item: number;
  opcoes: PdvOpcaoProduto[];
};

export type PdvCategoria = {
  id: number;
  nome: string;
};

export type PdvCliente = {
  id: number;
  nome: string;
  telefone: string;
  telefone_normalizado: string | null;
};

export default async function PdvPage() {
  const autorizado = await verificarAdmin();

  if (!autorizado) {
    redirect("/admin/login");
  }

  const [
    resultadoProdutos,
    resultadoCategorias,
    resultadoClientes,
    resultadoUltimoPedido,
  ] = await Promise.all([
    supabaseAdmin
      .from("produtos")
      .select(
        `
          id,
          nome,
          preco,
          preco_promocional,
          em_promocao,
          estoque,
          ativo,
          categoria_id,
          imagem_url,
          codigo_barras,
          unidades_por_item,
          opcoes:produto_opcoes (
            id,
            nome,
            ativo,
            ordem
          )
        `,
      )
      .eq("ativo", true)
      .order("nome", {
        ascending: true,
      }),

    supabaseAdmin
      .from("categorias")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome", {
        ascending: true,
      }),

    supabaseAdmin
      .from("clientes")
      .select(
        `
          id,
          nome,
          telefone,
          telefone_normalizado
        `,
      )
      .order("nome", {
        ascending: true,
      }),

    supabaseAdmin
      .from("pedidos")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (resultadoClientes.error) {
    console.error("Erro ao carregar clientes do PDV:", resultadoClientes.error);
  }

  if (resultadoProdutos.error) {
    console.error("Erro ao carregar produtos do PDV:", resultadoProdutos.error);
  }

  if (resultadoCategorias.error) {
    console.error(
      "Erro ao carregar categorias do PDV:",
      resultadoCategorias.error,
    );
  }

  if (resultadoUltimoPedido.error) {
    console.error(
      "Erro ao carregar monitor de pedidos:",
      resultadoUltimoPedido.error,
    );
  }

  const produtos = (resultadoProdutos.data ?? []).map((produto) => ({
    ...produto,

    preco: Number(produto.preco),

    preco_promocional:
      produto.preco_promocional !== null
        ? Number(produto.preco_promocional)
        : null,

    estoque: Number(produto.estoque),

    unidades_por_item: Number(produto.unidades_por_item ?? 0),

    opcoes:
      produto.opcoes
        ?.filter((opcao) => opcao.ativo)
        .sort((a, b) => a.ordem - b.ordem) ?? [],
  })) as PdvProduto[];

  const ultimoPedidoId = Number(resultadoUltimoPedido.data?.id ?? 0);

  return (
    <main className="min-h-screen w-full bg-[#070707] text-white">
      <div className="min-h-screen w-full p-3 lg:p-4">
        {/* MONITOR DE PEDIDOS DO DELIVERY */}
        {!resultadoUltimoPedido.error && (
          <AdminOrderAlerts
            ultimoPedidoId={ultimoPedidoId}
            atualizarPagina={false}
            embutido
          />
        )}

        <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin/pdv/caixa"
            className="rounded-xl border border-amber-400/30 bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
          >
            💰 Controle de Caixa
          </Link>

          <Link
            href="/admin/pdv/historico"
            className="rounded-xl border border-white/15 bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
          >
            🧾 Histórico de Vendas
          </Link>
        </div>

        {/* SISTEMA PDV */}
        <PdvClient
          produtos={produtos}
          categorias={(resultadoCategorias.data ?? []) as PdvCategoria[]}
          clientes={(resultadoClientes.data ?? []) as PdvCliente[]}
        />
      </div>
    </main>
  );
}

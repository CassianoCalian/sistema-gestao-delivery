"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AdminLogoutButton from "./AdminLogoutButton";

export default function AdminNavigation() {
  const pathname = usePathname();

  const dashboardAtivo = pathname === "/admin";
  const pedidosAtivo = pathname.startsWith("/admin/pedidos");
  const produtosAtivo = pathname.startsWith("/admin/produtos");
  const estoqueAtivo = pathname.startsWith("/admin/estoque");

  return (
    <div className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
            Depósito do Zé
          </p>

          <p className="mt-1 font-black text-white">Painel administrativo</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav className="flex flex-wrap rounded-xl border border-zinc-700 bg-zinc-950 p-1">
            <Link
              href="/admin"
              className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                dashboardAtivo
                  ? "bg-amber-400 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🏠 Dashboard
            </Link>

            <Link
              href="/admin/pedidos"
              className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                pedidosAtivo
                  ? "bg-amber-400 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              📦 Pedidos
            </Link>

            <Link
              href="/admin/produtos"
              className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                produtosAtivo
                  ? "bg-amber-400 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              🍺 Produtos
            </Link>

            <Link
              href="/admin/estoque"
              className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                estoqueAtivo
                  ? "bg-amber-400 text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              📊 Estoque
            </Link>
          </nav>

          <AdminLogoutButton />
        </div>
      </div>
    </div>
  );
}

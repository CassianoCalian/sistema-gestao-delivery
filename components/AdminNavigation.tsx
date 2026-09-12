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
  const clientesAtivo = pathname.startsWith("/admin/clientes");

  const itensNavegacao = [
    {
      href: "/admin",
      label: "Dashboard",
      descricao: "Visão geral",
      icone: "⌂",
      ativo: dashboardAtivo,
    },
    {
      href: "/admin/pedidos",
      label: "Pedidos",
      descricao: "Operação",
      icone: "📦",
      ativo: pedidosAtivo,
    },
    {
      href: "/admin/produtos",
      label: "Produtos",
      descricao: "Catálogo",
      icone: "🍺",
      ativo: produtosAtivo,
    },
    {
      href: "/admin/estoque",
      label: "Estoque",
      descricao: "Controle",
      icone: "📊",
      ativo: estoqueAtivo,
    },
    {
      href: "/admin/clientes",
      label: "Clientes",
      descricao: "CRM",
      icone: "👥",
      ativo: clientesAtivo,
    },
  ];

  return (
    <header className="group/nav relative mb-8 overflow-hidden rounded-[28px] border border-white/[0.07] bg-zinc-950/80 shadow-[0_25px_80px_rgba(0,0,0,0.26)] backdrop-blur-xl">
      {/* GLOWS */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-amber-400/[0.06] blur-[110px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-orange-500/[0.035] blur-[120px]"
      />

      {/* LINHA SUPERIOR */}
      <div className="relative flex flex-col gap-5 border-b border-white/[0.05] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        {/* IDENTIDADE */}
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-amber-400/20 bg-amber-400/[0.08] shadow-[0_0_30px_rgba(245,158,11,0.08)]">
            <span className="text-xl font-black text-amber-400">Z</span>

            <div className="absolute inset-x-2 bottom-1 h-px bg-linear-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-amber-400" />

              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-400">
                Depósito do Zé
              </p>
            </div>

            <p className="mt-1 text-lg font-black tracking-[-0.035em] text-white">
              Painel administrativo
            </p>
          </div>
        </div>

        {/* STATUS + LOGOUT */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>

            <span className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-400">
              Sistema online
            </span>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-1">
            <AdminLogoutButton />
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO */}
      <nav className="relative p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {itensNavegacao.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.ativo ? "page" : undefined}
              className={`group/item relative overflow-hidden rounded-[20px] border px-4 py-3.5 transition duration-500 hover:-translate-y-0.5 ${
                item.ativo
                  ? "border-amber-400/25 bg-amber-400/[0.07] shadow-[0_15px_45px_rgba(245,158,11,0.07)]"
                  : "border-white/[0.055] bg-white/[0.02] hover:border-white/[0.11] hover:bg-white/[0.035]"
              }`}
            >
              {/* GLOW DO ITEM */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition duration-500 ${
                  item.ativo
                    ? "bg-amber-400/[0.08]"
                    : "bg-white/[0.025] opacity-0 group-hover/item:opacity-100"
                }`}
              />

              <div className="relative flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border text-base transition duration-300 group-hover/item:scale-110 ${
                    item.ativo
                      ? "border-amber-400/25 bg-amber-400 text-zinc-950 shadow-[0_0_25px_rgba(245,158,11,0.14)]"
                      : "border-white/[0.07] bg-black/20 text-zinc-500"
                  }`}
                >
                  {item.icone}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`truncate text-sm font-black ${
                        item.ativo ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {item.label}
                    </p>

                    {item.ativo && (
                      <span className="rounded-full bg-amber-400 px-2 py-1 text-[6px] font-black uppercase tracking-[0.1em] text-zinc-950">
                        Ativo
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-0.5 text-[8px] font-bold uppercase tracking-[0.1em] ${
                      item.ativo ? "text-amber-400/70" : "text-zinc-700"
                    }`}
                  >
                    {item.descricao}
                  </p>
                </div>

                <span
                  className={`text-xs font-black transition-transform duration-300 group-hover/item:translate-x-1 ${
                    item.ativo ? "text-amber-400" : "text-zinc-700"
                  }`}
                >
                  →
                </span>
              </div>

              {/* INDICADOR INFERIOR */}
              <div
                className={`absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full transition-all duration-500 ${
                  item.ativo
                    ? "w-2/3 bg-linear-to-r from-transparent via-amber-400 to-transparent"
                    : "w-0 bg-white/20 group-hover/item:w-1/3"
                }`}
              />
            </Link>
          ))}
        </div>
      </nav>

      {/* RODAPÉ DA NAVEGAÇÃO */}
      <div className="relative flex items-center justify-between border-t border-white/[0.045] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

          <span className="text-[7px] font-black uppercase tracking-[0.14em] text-zinc-700">
            Central de gestão
          </span>
        </div>

        <span className="text-[7px] font-black uppercase tracking-[0.14em] text-zinc-800">
          Área restrita
        </span>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import AdminLogoutButton from "./AdminLogoutButton";

type IconType =
  | "dashboard"
  | "pedidos"
  | "produtos"
  | "categorias"
  | "estoque"
  | "clientes";

function NavIcon({ type }: { type: IconType }) {
  const baseProps = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (type === "dashboard") {
    return (
      <svg {...baseProps}>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    );
  }

  if (type === "pedidos") {
    return (
      <svg {...baseProps}>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    );
  }

  if (type === "produtos") {
    return (
      <svg {...baseProps}>
        <path d="M20.59 13.41 11 3.83V3H4v7h.83l9.58 9.59a2 2 0 0 0 2.82 0l3.36-3.36a2 2 0 0 0 0-2.82Z" />
        <circle cx="7.5" cy="6.5" r="1" />
      </svg>
    );
  }

  if (type === "categorias") {
    return (
      <svg {...baseProps}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  }

  if (type === "estoque") {
    return (
      <svg {...baseProps}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </svg>
    );
  }

  return (
    <svg {...baseProps}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export default function AdminNavigation() {
  const pathname = usePathname();

  const itensNavegacao: Array<{
    href: string;
    label: string;
    descricao: string;
    icone: IconType;
    ativo: boolean;
  }> = [
    {
      href: "/admin",
      label: "Dashboard",
      descricao: "Vis\u00e3o geral",
      icone: "dashboard",
      ativo: pathname === "/admin",
    },
    {
      href: "/admin/pedidos",
      label: "Pedidos",
      descricao: "Opera\u00e7\u00e3o",
      icone: "pedidos",
      ativo: pathname.startsWith("/admin/pedidos"),
    },
    {
      href: "/admin/produtos",
      label: "Produtos",
      descricao: "Cat\u00e1logo",
      icone: "produtos",
      ativo: pathname.startsWith("/admin/produtos"),
    },
    {
      href: "/admin/categorias",
      label: "Categorias",
      descricao: "Organiza\u00e7\u00e3o",
      icone: "categorias",
      ativo: pathname.startsWith("/admin/categorias"),
    },
    {
      href: "/admin/estoque",
      label: "Estoque",
      descricao: "Controle",
      icone: "estoque",
      ativo: pathname.startsWith("/admin/estoque"),
    },
    {
      href: "/admin/clientes",
      label: "Clientes",
      descricao: "CRM",
      icone: "clientes",
      ativo: pathname.startsWith("/admin/clientes"),
    },
  ];

  return (
    <header className="relative mb-8 overflow-hidden rounded-[28px] border border-white/[0.07] bg-zinc-950/90 shadow-[0_25px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 -top-28 h-72 w-72 rounded-full bg-amber-400/[0.05] blur-[110px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-orange-500/[0.03] blur-[120px]"
      />

      <div className="relative flex flex-col gap-5 border-b border-white/[0.05] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex items-center gap-4">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[17px] border border-amber-400/20 bg-amber-400/[0.08] shadow-[0_0_30px_rgba(245,158,11,0.08)]">
            <span className="text-xl font-black text-amber-400">
              Z
            </span>

            <div className="absolute inset-x-2 bottom-1 h-px bg-linear-to-r from-transparent via-amber-400/60 to-transparent" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-amber-400" />

              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-400">
                {"Dep\u00f3sito do Z\u00e9"}
              </p>
            </div>

            <p className="mt-1 text-lg font-black tracking-[-0.035em] text-white">
              Painel administrativo
            </p>
          </div>
        </div>

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

      <nav className="relative p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {itensNavegacao.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.ativo ? "page" : undefined}
              className={`group relative min-w-0 overflow-hidden rounded-[19px] border px-3.5 py-3.5 transition duration-300 hover:-translate-y-0.5 ${
                item.ativo
                  ? "border-amber-400/30 bg-amber-400/[0.08] shadow-[0_12px_35px_rgba(245,158,11,0.07)]"
                  : "border-white/[0.055] bg-white/[0.018] hover:border-white/[0.11] hover:bg-white/[0.035]"
              }`}
            >
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition duration-300 ${
                  item.ativo
                    ? "bg-amber-400/[0.08]"
                    : "bg-white/[0.02] opacity-0 group-hover:opacity-100"
                }`}
              />

              <div className="relative flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] border transition duration-300 group-hover:scale-105 ${
                    item.ativo
                      ? "border-amber-400/25 bg-amber-400 text-zinc-950 shadow-[0_0_25px_rgba(245,158,11,0.13)]"
                      : "border-white/[0.07] bg-black/20 text-zinc-500 group-hover:text-zinc-300"
                  }`}
                >
                  <NavIcon type={item.icone} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`whitespace-nowrap text-[13px] font-black tracking-[-0.015em] ${
                        item.ativo
                          ? "text-white"
                          : "text-zinc-400"
                      }`}
                    >
                      {item.label}
                    </p>

                    {item.ativo && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                      />
                    )}
                  </div>

                  <p
                    className={`mt-1 whitespace-nowrap text-[7px] font-black uppercase tracking-[0.13em] ${
                      item.ativo
                        ? "text-amber-400/70"
                        : "text-zinc-700"
                    }`}
                  >
                    {item.descricao}
                  </p>
                </div>
              </div>

              <div
                className={`absolute bottom-0 left-1/2 h-[2px] -translate-x-1/2 rounded-full transition-all duration-300 ${
                  item.ativo
                    ? "w-1/2 bg-linear-to-r from-transparent via-amber-400 to-transparent"
                    : "w-0 bg-white/20 group-hover:w-1/3"
                }`}
              />
            </Link>
          ))}
        </div>
      </nav>

      <div className="relative flex items-center justify-between border-t border-white/[0.045] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />

          <span className="text-[7px] font-black uppercase tracking-[0.14em] text-zinc-700">
            {"Central de gest\u00e3o"}
          </span>
        </div>

        <span className="text-[7px] font-black uppercase tracking-[0.14em] text-zinc-800">
          {"\u00c1rea restrita"}
        </span>
      </div>
    </header>
  );
}

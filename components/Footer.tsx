import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  const mensagemWhatsApp = encodeURIComponent(
    "Olá! Gostaria de fazer um pedido no Depósito do Zé.",
  );

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.06] bg-zinc-950 text-white">
      {/* LUZES DE FUNDO */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-amber-400/[0.05] blur-[110px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full bg-orange-600/[0.04] blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        {/* ÁREA PRINCIPAL */}
        <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:gap-10">
          {/* MARCA */}
          <div>
            <Link
              href="/"
              aria-label="Página inicial do Depósito do Zé"
              className="pressable relative block h-20 w-[150px] sm:h-24 sm:w-[180px]"
            >
              <Image
                src="/logo-deposito-ze.png"
                alt="Depósito do Zé"
                fill
                sizes="180px"
                className="object-contain object-left"
              />
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-6 text-zinc-500">
              Bebida gelada, preço bom e aquele atendimento que você já conhece.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-400">
                🍺 Bebida gelada
              </span>

              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-400">
                🛵 Entrega rápida
              </span>

              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-400">
                ⚡ Pedido online
              </span>
            </div>
          </div>

          {/* NAVEGAÇÃO */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
              Navegação
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/"
                className="pressable w-fit text-sm font-bold text-zinc-400 transition hover:text-white"
              >
                Início
              </Link>

              <Link
                href="/#produtos"
                className="pressable w-fit text-sm font-bold text-zinc-400 transition hover:text-white"
              >
                Produtos
              </Link>

              <Link
                href="/#categorias"
                className="pressable w-fit text-sm font-bold text-zinc-400 transition hover:text-white"
              >
                Categorias
              </Link>
            </div>
          </div>

          {/* CONTATO */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-amber-400">
              Fale com o Zé
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.025] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/[0.08]">
                    📍
                  </div>

                  <div>
                    <p className="text-xs font-black text-white">
                      Depósito do Zé
                    </p>

                    <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                      Av. Recife, 574
                      <br />
                      Jardim Pernambuco
                    </p>
                  </div>
                </div>
              </div>

              {whatsappNumber && (
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${mensagemWhatsApp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white shadow-[0_12px_35px_rgba(34,197,94,0.14)] transition hover:bg-emerald-400"
                >
                  <span>💬</span>
                  Chamar no WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        {/* DIVISOR */}
        <div className="section-divider my-8 sm:my-10" />

        {/* RODAPÉ INFERIOR */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold text-zinc-600">
              © 2026 Depósito do Zé. Todos os direitos reservados.
            </p>

            <p className="mt-1 text-[9px] text-zinc-700">
              Nova Iguaçu • Rio de Janeiro
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>

            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-zinc-600">
              Sistema online
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

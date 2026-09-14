import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-amber-400/[0.06] blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -right-32 h-96 w-96 rounded-full bg-orange-500/[0.05] blur-[140px]"
      />

      <section className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/[0.07] bg-white/[0.025] p-7 text-center shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-amber-400/15 bg-amber-400/[0.07] text-3xl">
          🍺
        </div>

        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">
          Erro 404
        </p>

        <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
          Essa página não foi encontrada
        </h1>

        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-400">
          O endereço que você tentou acessar não existe ou não está mais
          disponível.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="flex min-h-13 items-center justify-center rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
          >
            Voltar para a loja
          </Link>

          <Link
            href="/admin"
            className="flex min-h-13 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 text-sm font-black text-white transition hover:border-white/[0.15] hover:bg-white/[0.06]"
          >
            Ir para o painel
          </Link>
        </div>
      </section>
    </main>
  );
}

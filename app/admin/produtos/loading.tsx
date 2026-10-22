export default function Loading() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="min-h-[45vh] bg-zinc-950 px-5 py-8 text-white"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/20 border-t-amber-400" />
          <p className="text-sm font-bold text-amber-400">
            Carregando...
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="h-16 max-w-sm rounded-xl bg-white/[0.05]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-28 rounded-2xl bg-white/[0.04]" />
            <div className="h-28 rounded-2xl bg-white/[0.04]" />
            <div className="h-28 rounded-2xl bg-white/[0.04]" />
          </div>
        </div>
      </div>
    </main>
  );
}
export default function HeroBanner() {
  return (
    <section className="mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600">
      <div className="grid min-h-[360px] items-center gap-8 p-8 md:grid-cols-2 md:p-14">
        <div>
          <span className="inline-block rounded-full bg-black/20 px-4 py-2 text-sm font-bold">
            🔥 OFERTA DO ZÉ
          </span>

          <h2 className="mt-6 text-4xl font-black leading-tight text-zinc-950 md:text-6xl">
            O combo que salva a noite.
          </h2>

          <p className="mt-4 max-w-lg text-lg font-medium text-zinc-900">
            5 unidades de GT + 5 gelos de coco + 5 copos de 500ml.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-5">
            <div>
              <p className="text-sm font-bold uppercase text-zinc-800">
                Dinheiro ou Pix
              </p>

              <p className="text-4xl font-black text-zinc-950">R$ 46,00</p>
            </div>

            <button className="rounded-xl bg-zinc-950 px-7 py-4 font-bold text-white transition hover:scale-105">
              Pedir agora
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="flex h-64 w-64 items-center justify-center rounded-full bg-black/10 text-9xl backdrop-blur">
            🍹
          </div>
        </div>
      </div>
    </section>
  );
}

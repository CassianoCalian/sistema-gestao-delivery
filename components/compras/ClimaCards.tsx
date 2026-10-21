"use client";

type DiaClima = {
  data: string;
  maxima: number | null;
  chuva: boolean;
};

type Props = {
  clima: DiaClima[];
};

function dataHoje() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatarDia(data: string) {
  const valor = new Date(`${data}T12:00:00-03:00`);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "America/Sao_Paulo",
  }).format(valor).replace(".", "");
}

function formatarData(data: string) {
  const partes = data.split("-");
  return partes.length === 3
    ? `${partes[2]}/${partes[1]}`
    : data;
}

function aparencia(dia: DiaClima) {
  const temperatura = dia.maxima ?? 0;

  if (dia.chuva && temperatura >= 30) {
    return {
      emoji: "🌦️",
      titulo: "Quente e chuvoso",
      cor: "text-orange-200",
      borda: "border-orange-400/25",
      fundo: "from-orange-500/15 to-sky-500/5",
      mensagem: "Calor e chuva previstos",
    };
  }

  if (dia.chuva) {
    return {
      emoji: "🌧️",
      titulo: "Chuva prevista",
      cor: "text-sky-200",
      borda: "border-sky-400/25",
      fundo: "from-sky-500/15 to-indigo-500/5",
      mensagem: "Acompanhar entregas",
    };
  }

  if (temperatura >= 33) {
    return {
      emoji: "🥵",
      titulo: "Muito quente",
      cor: "text-orange-200",
      borda: "border-orange-400/25",
      fundo: "from-orange-500/20 to-amber-500/5",
      mensagem: "Atenção às bebidas geladas",
    };
  }

  if (temperatura >= 28) {
    return {
      emoji: "🌡️",
      titulo: "Dia quente",
      cor: "text-amber-200",
      borda: "border-amber-400/25",
      fundo: "from-amber-500/15 to-orange-500/5",
      mensagem: "Temperatura elevada",
    };
  }

  if (temperatura >= 23) {
    return {
      emoji: "🌤️",
      titulo: "Temperatura amena",
      cor: "text-emerald-200",
      borda: "border-emerald-400/20",
      fundo: "from-emerald-500/10 to-cyan-500/5",
      mensagem: "Sem chuva indicada",
    };
  }

  return {
    emoji: "🍃",
    titulo: "Mais fresco",
    cor: "text-cyan-200",
    borda: "border-cyan-400/20",
    fundo: "from-cyan-500/15 to-indigo-500/5",
    mensagem: "Temperatura mais baixa",
  };
}

export default function ClimaCards({ clima }: Props) {
  const hoje = dataHoje();

  const diaAtual = clima.find((dia) => dia.data === hoje) ?? clima[0];

  const destaque = diaAtual ? aparencia(diaAtual) : null;

  return (
    <section className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-[#101319] text-white shadow-2xl">
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-r from-[#132b43] via-[#16212d] to-[#111318] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl motion-safe:animate-pulse" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
              <span className="h-2 w-2 rounded-full bg-sky-400 motion-safe:animate-pulse" />
              Monitoramento climático
            </div>

            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Tempo em Nova Iguaçu
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              Previsão dos próximos dias para planejar as compras
            </p>
          </div>

          <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">
            📍 Nova Iguaçu, RJ
          </div>
        </div>

        {diaAtual && destaque && (
          <div className="relative mt-7 flex flex-wrap items-center gap-5">
            <div className="text-6xl drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)] motion-safe:animate-bounce sm:text-7xl">
              {destaque.emoji}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-200">
                {diaAtual.data === hoje ? "Hoje" : formatarData(diaAtual.data)}
                {" · "}Máxima prevista
              </p>

              <div className="mt-1 text-5xl font-black tracking-tight sm:text-6xl">
                {diaAtual.maxima !== null
                  ? `${diaAtual.maxima.toFixed(1)}°`
                  : "--"}
              </div>

              <p className={`mt-1 text-sm font-semibold ${destaque.cor}`}>
                {destaque.titulo}
              </p>
            </div>

            <div className="ml-auto rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              <p className="font-bold text-white">
                {diaAtual.chuva ? "💧 Chuva prevista" : "🌡️ Temperatura monitorada"}
              </p>

              <p className="mt-1">
                Previsão · MET Norway
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {clima.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {clima.map((dia) => {
              const visual = aparencia(dia);
              const ehHoje = dia.data === hoje;

              return (
                <div
                  key={dia.data}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${visual.fundo} ${visual.borda} p-3 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-sky-500/10 sm:p-4`}
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    {ehHoje ? "Hoje" : formatarDia(dia.data)}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatarData(dia.data)}
                  </p>

                  <div className="my-4 text-5xl transition-transform duration-300 motion-safe:animate-pulse group-hover:scale-110">
                    {visual.emoji}
                  </div>

                  <p className="text-3xl font-black tabular-nums tracking-tight">
                    {dia.maxima !== null
                      ? `${dia.maxima.toFixed(1)}°`
                      : "--"}
                  </p>

                  <p className={`mt-2 min-h-9 text-xs font-bold ${visual.cor}`}>
                    {visual.titulo}
                  </p>

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <p className="text-[10px] leading-relaxed text-slate-400">
                      {visual.mensagem}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
            <div className="text-4xl">🌥️</div>
            <p className="mt-2 text-sm text-slate-300">
              A previsão meteorológica está temporariamente indisponível.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/10 bg-amber-400/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-amber-100/90">
            💡 <strong>Inteligência de compras:</strong> calor e chuva ajudam
            a avaliar a demanda de bebidas, gelo e entregas. Os valores de
            compras continuam sujeitos ao histórico e ao estoque disponível.
          </p>
        </div>

        <p className="mt-3 text-right text-[11px] text-slate-500">
          Dados meteorológicos: MET Norway · Previsões sujeitas a mudanças
        </p>
      </div>
    </section>
  );
}
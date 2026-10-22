"use client";

import { useState } from "react";

export default function ValorProtegido({
  texto,
  mascara = "*****",
}: {
  texto: string;
  mascara?: string;
}) {
  const [visivel, setVisivel] = useState(false);

  function alternar(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    setVisivel((anterior) => !anterior);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">
        {visivel ? texto : mascara}
      </span>

      <span
        role="button"
        tabIndex={0}
        aria-label={visivel ? "Ocultar valor" : "Mostrar valor"}
        aria-pressed={visivel}
        onClick={alternar}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            alternar(event);
          }
        }}
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-amber-400/30 px-2 py-1 text-xs font-bold text-amber-400"
      >
        <span aria-hidden="true">&#128065;</span>
        {visivel ? "Ocultar" : "Mostrar"}
      </span>
    </span>
  );
}
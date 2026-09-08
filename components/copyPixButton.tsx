"use client";

import { useState } from "react";

type CopyPixButtonProps = {
  pixKey: string;
};

export default function CopyPixButton({ pixKey }: CopyPixButtonProps) {
  const [copiado, setCopiado] = useState(false);

  async function copiarPix() {
    try {
      await navigator.clipboard.writeText(pixKey);

      setCopiado(true);

      setTimeout(() => {
        setCopiado(false);
      }, 2000);
    } catch {
      alert("Não foi possível copiar a chave PIX.");
    }
  }

  return (
    <button
      type="button"
      onClick={copiarPix}
      className="w-full rounded-xl bg-amber-400 px-6 py-4 font-black text-zinc-950 transition hover:bg-amber-300"
    >
      {copiado ? "✓ Chave PIX copiada!" : "Copiar chave PIX"}
    </button>
  );
}

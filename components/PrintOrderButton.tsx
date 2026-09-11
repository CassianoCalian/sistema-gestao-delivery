"use client";

export default function PrintOrderButton() {
  function imprimirPedido() {
    window.print();
  }

  return (
    <button
      type="button"
      onClick={imprimirPedido}
      className="pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.08] px-5 py-3 text-sm font-black text-amber-400 transition hover:border-amber-400/40 hover:bg-amber-400/[0.12]"
    >
      <span>🖨️</span>
      Imprimir pedido
    </button>
  );
}

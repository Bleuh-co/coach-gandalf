"use client";

/** Gros compte à rebours plein écran avant le départ (« Placez-vous ! »). */
export function CountdownOverlay({ value, label }: { value: number; label?: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-chanv-terre/95 flex flex-col items-center justify-center">
      <span className="text-chanv-beige text-2xl md:text-4xl font-black uppercase tracking-widest mb-6 text-center px-4">
        {label || "Placez-vous !"}
      </span>
      <span className="text-white font-black tabular-nums leading-none" style={{ fontSize: "min(40vh, 40vw)" }}>
        {value}
      </span>
    </div>
  );
}

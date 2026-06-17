"use client";

import { useRef, useEffect } from "react";

interface Props {
  videoUrl?: string | null;
  preloadVideoUrl?: string | null;
  label?: string;
}

/**
 * Lecteur vidéo en boucle pour l'exercice courant.
 * La vidéo provient de Firebase Storage (URL portée par le programme).
 * Précharge la vidéo du prochain exercice (élément caché).
 * Fallback visuel si aucune URL valide.
 */
export function ExerciceVideo({ videoUrl, preloadVideoUrl, label }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = videoUrl || null;
  const preloadSrc = preloadVideoUrl || null;

  useEffect(() => {
    const v = ref.current;
    if (v && src) {
      v.load();
      v.play().catch(() => {});
    }
  }, [src]);

  return (
    <div className="relative w-full aspect-video rounded-chanv overflow-hidden bg-chanv-terre flex items-center justify-center">
      {src ? (
        <video
          ref={ref}
          className="w-full h-full object-cover"
          src={src}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-chanv-fibre/70 gap-3">
          <span className="text-7xl">🏋️</span>
          <span className="text-2xl font-semibold uppercase tracking-widest">
            {label || "Exercice"}
          </span>
          <span className="text-sm opacity-60">Vidéo non disponible</span>
        </div>
      )}

      {label && src && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <span className="text-4xl font-black text-white uppercase tracking-wide drop-shadow-lg">
            {label}
          </span>
        </div>
      )}

      {/* Préchargement invisible du prochain clip */}
      {preloadSrc && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={preloadSrc} preload="auto" muted className="hidden" />
      )}
    </div>
  );
}

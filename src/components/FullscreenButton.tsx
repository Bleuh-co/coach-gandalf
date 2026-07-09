"use client";

import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { useT } from "@/lib/i18n";

/** Bascule l'affichage en plein écran (masque la barre du navigateur sur le kiosque). */
export function FullscreenButton() {
  const t = useT();
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* certains navigateurs/contours peuvent refuser ; sans gravité */
    }
  };

  return (
    <button
      onClick={toggle}
      title={isFs ? t("nav.fullscreenExit") : t("nav.fullscreenEnter")}
      className="text-white/80 hover:text-white border border-white/30 rounded-full p-2"
      aria-label={isFs ? t("nav.fullscreenExit") : t("nav.fullscreenEnter")}
    >
      {isFs ? <Minimize size={18} /> : <Maximize size={18} />}
    </button>
  );
}

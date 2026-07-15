"use client";

import { useEffect } from "react";

/**
 * Widgets flottants du hub (chatbot 🧙, feedback 💬, drawer Gandalf) —
 * STANDALONE seulement. Le signal fiable est « suis-je réellement framé ? »
 * (window.self !== window.top) : le flag serveur `embedded` dérive du cookie
 * gandalf_embed (collant) — une visite embed contaminait ensuite le standalone
 * (widgets absents → burger mort). En embed, le shell Gandalf fournit ce chrome.
 */
export function StandaloneWidgets({ hubUrl, scripts }: { hubUrl: string; scripts: string[] }) {
  useEffect(() => {
    if (window.self !== window.top) return; // iframe du hub : chrome fourni par le shell
    if (document.getElementById("gandalf-standalone-widgets")) return;
    const mark = document.createElement("meta");
    mark.id = "gandalf-standalone-widgets";
    document.head.appendChild(mark);
    for (const path of scripts) {
      const s = document.createElement("script");
      s.src = `${hubUrl}${path}`;
      s.defer = true;
      s.setAttribute("data-hub", hubUrl);
      document.body.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

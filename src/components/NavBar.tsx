"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Library, Settings2 } from "lucide-react";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";
import { useAuth } from "./AuthProvider";
import { Sidebar } from "./Sidebar";
import { FullscreenButton } from "./FullscreenButton";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Role } from "@/lib/types";

interface NavLink {
  href: string;
  labelKey: string;
  icon: typeof Dumbbell;
  roles?: Role[]; // absent = visible pour tous
}

// « masqué ≠ perdu » : la même liste (liens role-gated inclus) alimente la
// barre standalone ET la nav d'embed — aucun lien ne disparaît en mode embarqué.
const LINKS: NavLink[] = [
  // Séance IA (génération) = builder → Administrateur+ (décision recette).
  { href: "/gandalf", labelKey: "nav.seanceIA", icon: Dumbbell, roles: ["admin", "superadmin"] },
  { href: "/programmes", labelKey: "nav.programmes", icon: Library },
  { href: "/admin", labelKey: "nav.admin", icon: Settings2, roles: ["superadmin"] },
];

export function NavBar() {
  const { session } = useAuth();
  const { embedded } = useGandalf();
  const pathname = usePathname();
  const t = useT();

  // Le flag `embedded` du SDK dérive du cookie gandalf_embed (collant) : après
  // une visite embed il reste vrai en standalone → chrome d'embed sans burger.
  // On corrige avec le VRAI framing (window.self !== window.top), en partant de
  // la valeur SSR pour éviter un mismatch d'hydratation.
  const [reallyEmbedded, setReallyEmbedded] = useState(embedded);
  useEffect(() => {
    setReallyEmbedded(window.self !== window.top);
  }, []);

  if (!session) return null;

  const visible = LINKS.filter((l) => !l.roles || l.roles.includes(session.role));

  if (reallyEmbedded) {
    // Contrat d'embed, morceau 3 — nav interne d'embed (#gandalf-embed-nav),
    // modèle xero/Gestion-Parc-It : barre claire sticky sur fond parchemin,
    // pastilles blanches arrondies, pastille active or. Le hub fournit
    // logo/titre/profil — on ne les répète pas dans l'iframe.
    return (
      <nav
        id="gandalf-embed-nav"
        className="sticky top-0 z-40 flex flex-wrap items-center gap-1.5 bg-[#F4EFE3] px-4 pb-1 pt-3"
      >
        {visible.map((l) => {
          const Icon = l.icon;
          const active = pathname === l.href || pathname?.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                active
                  ? "border-[#A8863F] bg-[#A8863F] font-bold text-white"
                  : "border-black/10 bg-white text-black/60 hover:border-[#A8863F]/40 hover:text-[#282828]",
              )}
            >
              <Icon size={15} />
              <span>{t(l.labelKey)}</span>
            </Link>
          );
        })}
        <span className="ml-auto">
          <FullscreenButton />
        </span>
      </nav>
    );
  }

  return (
    <header className="chanv-header">
      <div className="mx-auto max-w-5xl flex items-center gap-6 flex-nowrap relative flex-col md:flex-row text-center md:text-left">
        <a
          href={process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com"}
          className="chanv-logo-wrapper flex items-center"
          title={t("nav.backToHub")}
        >
          <Image
            src="/logo-groupe-chanv.svg"
            alt="Chanv"
            width={130}
            height={44}
            priority
            className="h-10 w-auto"
          />
        </a>
        <div>
          <h1 className="text-xl font-bold m-0 leading-tight">🚀 {t("app.title")}</h1>
          <p className="text-[10px] md:text-[11px] uppercase tracking-[3px] opacity-70 mt-1 m-0">
            {t("app.subtitle")}
          </p>
        </div>

        <nav className="flex items-center gap-4 md:ml-6">
          {visible.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[11px] uppercase tracking-wider text-white/80 hover:text-white whitespace-nowrap"
            >
              {t(l.labelKey)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 md:ml-auto absolute top-0 right-0 md:relative md:top-auto md:right-auto">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-white whitespace-nowrap">
              {session.displayName || session.email}
            </div>
            <div className="text-[11px] text-white/60 uppercase tracking-wider whitespace-nowrap">
              {t(`role.${session.role}`)}
            </div>
          </div>
          <FullscreenButton />
          <Sidebar />
        </div>
      </div>
    </header>
  );
}

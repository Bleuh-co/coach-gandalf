import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { Toaster } from "sonner";
import Script from "next/script";
import { headers } from "next/headers";
import { GandalfProvider } from "@bleuh-co/gandalf-sdk-next/client";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { StandaloneWidgets } from "@/components/StandaloneWidgets";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com";

export const metadata: Metadata = {
  title: "Coach Gandalf — Chanv",
  description: "Système intelligent d'entraînement — Groupe Chanv",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Coach Gandalf",
  },
};

export const viewport = {
  themeColor: "#282828",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Contexte d'embarquement Gandalf, posé par le middleware (x-gandalf-*).
  const h = await headers();
  const embedded = h.get("x-gandalf-embedded") === "1";
  const lang = h.get("x-gandalf-lang") || "fr";
  const theme = h.get("x-gandalf-theme") || "light";
  return (
    <html
      lang={lang}
      className={`${inter.variable} ${outfit.variable}${theme === "dark" ? " gandalf-dark" : ""}`}
    >
      <body className="min-h-screen antialiased font-sans">
        <GandalfProvider embedded={embedded} lang={lang} theme={theme}>
          <AuthProvider>
            {children}
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </GandalfProvider>
        {/* Pont d'auth pour les widgets Hub (token Firebase courant). */}
        <Script id="chanv-auth-bridge" strategy="beforeInteractive">{`
          window.getAuthToken = async function() {
            try {
              const { getAuth } = await import('firebase/auth');
              const auth = getAuth();
              if (auth.currentUser) return await auth.currentUser.getIdToken();
            } catch(e) {}
            return null;
          };
        `}</Script>
        {/* Widgets flottants du hub — STANDALONE seulement. AVANT : gardés par le
            flag serveur `!embedded` (dérivé du cookie gandalf_embed collant) qui
            contaminait le standalone. Le composant client vérifie le VRAI framing
            (window.self !== window.top). */}
        <StandaloneWidgets hubUrl={HUB_URL} scripts={["/widgets/chatbot.js", "/widgets/feedback.js", "/js/gandalf-widget.js"]} />
        {/* Service worker — rend la PWA installable */}
        <Script id="register-sw" strategy="afterInteractive">{`
          if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js').catch(err => {
                console.warn('SW registration failed:', err);
              });
            });
          }
        `}</Script>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { getConfig } from "@/lib/config";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const cfg = getConfig();
  return {
    title: cfg.storeName,
    description: cfg.tagline,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cfg = getConfig();
  const gFonts = encodeURIComponent(`${cfg.fonts.heading}:ital,wght@0,400;0,700;1,400&family=${cfg.fonts.body}:wght@400;500;600`);

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href={`https://fonts.googleapis.com/css2?family=${gFonts}&display=swap`}
          rel="stylesheet"
        />
        <style>{`
          :root {
            --color-primary: ${cfg.colors.primary};
            --color-secondary: ${cfg.colors.secondary};
            --color-accent: ${cfg.colors.accent};
            --font-heading: "${cfg.fonts.heading}";
            --font-body: "${cfg.fonts.body}";
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

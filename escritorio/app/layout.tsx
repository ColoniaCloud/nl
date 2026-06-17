import type { Metadata } from "next";
import "./globals.css";
import { Inter, Syne, Montserrat } from "next/font/google";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NL360",
  description: "NL360 Escritorio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${syne.variable} ${montserrat.variable}`}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}

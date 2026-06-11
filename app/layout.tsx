import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mareas & Pesca · Golfo de Cádiz y Costa da Morte",
  description:
    "Mejores días y horas para pescar desde costa (Golfo de Cádiz y Costa da Morte), según mareas oficiales del IHM, datos solunares y meteo-marina.",
};

export const viewport: Viewport = {
  themeColor: "#122636",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

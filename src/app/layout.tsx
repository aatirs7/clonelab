import type { Metadata, Viewport } from "next";
import { Archivo, Chivo_Mono } from "next/font/google";
import "./globals.css";

// Archivo is a grotesque cut for signage, which suits a tool that is read at a glance
// while the operator is doing something else. Chivo Mono carries every timecode,
// duration and dollar figure, and in this app that is most of the numbers on screen.
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const chivoMono = Chivo_Mono({ subsets: ["latin"], variable: "--font-chivo-mono", display: "swap" });

export const metadata: Metadata = {
  title: "CloneLab",
  description: "Shot plan, teleprompter and render for one continuous take.",
};

export const viewport: Viewport = {
  themeColor: "#0e1013",
  width: "device-width",
  initialScale: 1,
  // The teleprompter is read at arm's length while filming, so a stray pinch zoom
  // mid-take is worse than the accessibility cost of pinning the scale.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${chivoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

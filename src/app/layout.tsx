import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  title: "Pulse",
  description: "Anonymous surveys for team meetups. Share a QR code, collect answers, review together.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="px-5 py-4 flex items-center justify-between">
          <Link href="/" className="font-[family-name:var(--font-display)] font-bold text-lg tracking-tight">
            Pulse
          </Link>
          <span className="label">Anonymous team surveys</span>
        </header>
        <main className="flex-1 px-5 pb-16">{children}</main>
      </body>
    </html>
  );
}

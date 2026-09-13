import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rendy Pulse",
  description: "Anonymous surveys for team meetups. Share a QR code, collect answers, review together.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="px-5 py-4 flex items-center justify-between border-b border-line">
          <Link href="/" className="flex items-center gap-3" aria-label="Rendy Pulse home">
            <Logo className="h-6 w-auto text-ink" />
            <span className="text-sm font-medium text-muted border-l border-line pl-3">Pulse</span>
          </Link>
          <span className="label">Anonymous team surveys</span>
        </header>
        <main className="flex-1 px-5 pb-16">{children}</main>
      </body>
    </html>
  );
}

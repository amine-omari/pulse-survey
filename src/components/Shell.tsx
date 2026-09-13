import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Header + padded main for host-facing pages. The participant page draws its own dark shell. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="px-5 py-4 flex items-center justify-between border-b border-line">
        <Link href="/" className="flex items-center gap-3" aria-label="Rendy Pulse home">
          <Logo className="h-6 w-auto text-ink" />
          <span className="text-sm font-medium text-muted border-l border-line pl-3">Pulse</span>
        </Link>
        <span className="label">Anonymous team surveys</span>
      </header>
      <main className="flex-1 px-5 pb-16">{children}</main>
    </>
  );
}

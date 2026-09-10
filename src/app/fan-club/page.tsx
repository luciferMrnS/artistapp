import { Home } from "lucide-react";
import Link from "next/link";
import { FanCommunity } from "@/components/community/FanCommunity";

export default function FanClubPage() {
  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <header className="border-b border-border bg-zinc-900 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Fan Community</h1>
            <p className="text-sm text-secondary">Chat, share, and connect with fellow fans</p>
          </div>
          <Link
            href="/"
            title="Back to home"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-secondary transition hover:border-primary/40 hover:text-white"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <FanCommunity />
      </main>
    </div>
  );
}

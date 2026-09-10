"use client";

import {
  Disc3,
  Shirt,
  Image as PosterIcon,
  CassetteTape,
  Ticket,
  Headphones,
  ShoppingBag,
} from "lucide-react";
import { useComingSoon } from "@/components/ui/ComingSoonProvider";

interface MerchItem {
  name: string;
  price: string;
  desc: string;
  tag: string;
  tone: string;
  icon: React.ReactNode;
}

const MERCH: MerchItem[] = [
  {
    name: '"GNX" Vinyl LP',
    price: "$40.00",
    desc: "180g black vinyl, 2LP gatefold with lyric book.",
    tag: "Vinyl",
    tone: "from-purple-500/80 to-indigo-600/80",
    icon: <Disc3 className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Crewneck Hoodie",
    price: "$65.00",
    desc: "Heavyweight cotton blend with chest embroidery.",
    tag: "Apparel",
    tone: "from-emerald-500/80 to-teal-600/80",
    icon: <Shirt className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Tour Tee",
    price: "$35.00",
    desc: "Soft-wash tee from the live session run.",
    tag: "Apparel",
    tone: "from-orange-500/80 to-rose-600/80",
    icon: <Shirt className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Signed Poster",
    price: "$25.00",
    desc: "Hand-signed 12x18 poster, individually numbered.",
    tag: "Limited",
    tone: "from-sky-500/80 to-blue-600/80",
    icon: <PosterIcon className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Mixtape Cassette",
    price: "$22.00",
    desc: "Limited-runs cassette with all the B-sides.",
    tag: "Collectible",
    tone: "from-cyan-500/80 to-teal-600/80",
    icon: <CassetteTape className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Live Session Pass",
    price: "$75.00",
    desc: "Front-of-room pass to the next in-studio session.",
    tag: "Exclusive",
    tone: "from-rose-500/80 to-pink-600/80",
    icon: <Ticket className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Studio Headphones",
    price: "$89.00",
    desc: "Studio-grade cans tuned for that clean mix.",
    tag: "Gear",
    tone: "from-zinc-500/80 to-zinc-700/80",
    icon: <Headphones className="h-12 w-12 text-white/90" />,
  },
  {
    name: "Canvas Tote",
    price: "$18.00",
    desc: "Organic canvas tote with the GNX print.",
    tag: "Accessory",
    tone: "from-lime-500/80 to-emerald-600/80",
    icon: <ShoppingBag className="h-12 w-12 text-white/90" />,
  },
];

/**
 * Artist merch marketplace. Every "Buy now" button opens the shared
 * animated Coming soon popup — checkout launches later.
 */
export function MerchStore() {
  const { openComingSoon } = useComingSoon();

  return (
    <section className="mx-4 mt-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-secondary">
            Official marketplace
          </p>
          <h2 className="text-2xl font-black">The Store</h2>
        </div>
        <p className="text-xs text-secondary">All prices in USD • worldwide shipping</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MERCH.map((item) => (
          <div
            key={item.name}
            className="group overflow-hidden rounded-2xl border border-border bg-zinc-900/60 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-zinc-900"
          >
            <div
              className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${item.tone} transition-transform duration-300 group-hover:scale-[1.02]`}
            >
              {item.icon}
              <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                {item.tag}
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold leading-tight">{item.name}</h4>
                <span className="shrink-0 text-lg font-black text-primary">
                  {item.price}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                {item.desc}
              </p>
              <button
                type="button"
                onClick={() => openComingSoon(item.name)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2 text-sm font-bold text-white transition hover:opacity-90 hover:shadow-[0_0_20px_rgba(29,155,240,0.4)]"
              >
                <ShoppingBag className="h-4 w-4" /> Buy now
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
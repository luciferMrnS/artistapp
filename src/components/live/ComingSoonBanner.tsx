import { Radio, Sparkles } from "lucide-react";

/**
 * Animated "Coming soon, stay tuned" banner shown on the Live Now page.
 * Pure CSS animations (gradient sweep + sheen + floating icon) so it renders
 * immediately with no hydration dependency.
 */
export function ComingSoonBanner() {
  return (
    <div className="relative mx-4 mt-6 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-rose-600 via-purple-600 to-orange-500 p-5 animate-gradient-x">
      <div className="banner-shine pointer-events-none absolute inset-y-0 w-1/3 bg-white/20 blur-md" />

      <div className="relative flex items-center gap-4">
        <div className="animate-float-bounce flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm">
          <Radio className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/80">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Live broadcasts
          </p>
          <h2 className="text-2xl font-black tracking-tight text-white drop-shadow">
            Coming soon
          </h2>
          <p className="mt-0.5 text-sm font-medium text-white/90">
            Stay tuned — the artist is getting ready to go live.
          </p>
        </div>

        <div className="ml-auto hidden flex-col items-end gap-1.5 sm:flex">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
            Stay tuned
          </span>
        </div>
      </div>
    </div>
  );
}
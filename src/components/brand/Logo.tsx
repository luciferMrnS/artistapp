import { cn } from "@/lib/utils";

/**
 * Site brand mark. Uses the same `logo.png` as the favicon/icon file.
 * `size` controls the square crop; defaults to the small sidebar size.
 */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Kendrick David"
      className={cn("rounded-full object-cover shadow-lg shadow-primary/20", className)}
    />
  );
}
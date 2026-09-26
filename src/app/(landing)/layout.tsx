import type { ReactNode } from "react";
import { Hi_Melody, Inter, Mochiy_Pop_P_One, Nothing_You_Could_Do } from "next/font/google";
import "./landing.css";

/**
 * Fonts lifted from the artist's existing Carrd page so the landing page reads
 * as the same brand. Declared here (not in the root layout) so the community
 * app never downloads them.
 */
const display = Nothing_You_Could_Do({
  weight: "400",
  subsets: ["latin"],
  variable: "--lp-display",
  display: "swap",
});

const eyebrow = Hi_Melody({
  weight: "400",
  subsets: ["latin"],
  variable: "--lp-eyebrow",
  display: "swap",
});

const body = Mochiy_Pop_P_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--lp-body",
  display: "swap",
});

const ui = Inter({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--lp-ui",
  display: "swap",
});

/**
 * globals.css hard-codes `html { background: #000 }` for the community app's
 * overscroll. Flip the document canvas to the landing palette during parse —
 * a blocking script, so there is no flash of black behind a light page.
 */
const LIGHT_CANVAS = "document.documentElement.setAttribute('data-theme','light')";

export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-landing=""
      className={`${display.variable} ${eyebrow.variable} ${body.variable} ${ui.variable} min-h-screen w-full overflow-x-hidden`}
    >
      <script dangerouslySetInnerHTML={{ __html: LIGHT_CANVAS }} />
      {children}
    </div>
  );
}

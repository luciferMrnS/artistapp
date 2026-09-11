import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bangers } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { SelfKeepAlive } from "@/components/SelfKeepAlive";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used by the Creed announcement banner. Loaded here (server component) so the
// font runtime never executes in the browser — next/font inside a client
// component can crash route bootstrap on a hard reload.
const bangers = Bangers({
  variable: "--font-bangers",
  weight: "400",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
  ),
  title: {
    default: "Kendrick David | Artist Community",
    template: "%s | Kendrick David",
  },
  description:
    "Artist updates, fan posts, and live sessions built for a social-first music brand.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kendrick David",
  },
  openGraph: {
    type: "website",
    siteName: "Kendrick David",
    title: "Kendrick David | Artist Community",
    description:
      "Artist updates, fan posts, and live sessions built for a social-first music brand.",
    url: "/",
    images: [{ url: "/icon.png", width: 1024, height: 1024, alt: "Kendrick David" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kendrick David | Artist Community",
    description:
      "Artist updates, fan posts, and live sessions built for a social-first music brand.",
    images: ["/icon.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bangers.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-white">
        <AuthProvider>
          <PresenceHeartbeat />
          <SelfKeepAlive />
          <PwaSetup />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    apple: "/icon.png",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-black text-white">
        <AuthProvider>
          <PresenceHeartbeat />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

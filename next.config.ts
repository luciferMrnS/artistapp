import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Feed posters uploaded through /landing-feed live in a public Supabase
    // storage bucket, so next/image has to be allowed to optimize them.
    // Scoped to this project's own Supabase host (the subdomain is the
    // per-tenant project ref) plus the public-object path.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;

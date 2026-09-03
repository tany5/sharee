import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Real saree photography (women wearing the sarees) — Pexels CDN.
      { protocol: "https", hostname: "images.pexels.com" },
      // Supabase "Sharee" storage bucket (admin-uploaded product photos).
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;

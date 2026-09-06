import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native modules must stay outside the bundler (sharp for image ops, the
  // static ffmpeg binary for the marketing reel renderer).
  serverExternalPackages: ["sharp", "ffmpeg-static"],
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

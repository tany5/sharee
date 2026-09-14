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
  async headers() {
    return [
      {
        // HTTPS enforcement at the browser level: after the first HTTPS visit,
        // the browser refuses plain HTTP for two years (Vercel terminates TLS
        // and already redirects HTTP→HTTPS; HSTS closes the downgrade gap).
        // Harmless on localhost dev — HSTS is ignored over plain HTTP.
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;

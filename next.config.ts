import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Ghost60 serves per-request dynamic routes (auth, daily game, challenges):
     classic App Router behavior instead of static-first cacheComponents. */
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

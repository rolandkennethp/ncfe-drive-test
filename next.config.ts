import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Experimental caching is off: every page reads your Google session at request time.
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API runs separately (apps/api). Its address is set with NEXT_PUBLIC_API_URL.
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

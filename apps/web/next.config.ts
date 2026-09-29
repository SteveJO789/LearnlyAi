import type { NextConfig } from "next";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: "/api/learning/:path*",
        destination: `${API_BASE_URL}/learning/:path*`,
      },
    ];
  },
};

export default nextConfig;

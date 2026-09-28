import type { NextConfig } from "next";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_LEARNING_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: "/api/learning/:path*",
        destination: `${API_BASE_URL}/api/learning/:path*`,
      },
    ];
  },
};

export default nextConfig;
import type { NextConfig } from "next";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async rewrites() {
    return [
      { source: "/api/users/:path*", destination: `${API_BASE_URL}/users/:path*` },
      {
        source: "/api/learning/:path*",
        destination: `${API_BASE_URL}/learning/:path*`,
      },
      {
        source: "/api/learning-sessions",
        destination: `${API_BASE_URL}/learning-sessions`,
      },
      {
        source: "/api/learning-sessions/:path*",
        destination: `${API_BASE_URL}/learning-sessions/:path*`,
      },
    ];
  },
};

export default nextConfig;

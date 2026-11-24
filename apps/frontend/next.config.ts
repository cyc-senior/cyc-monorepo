import type { NextConfig } from "next";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * Where `/api/*` on this site is proxied: `BACKEND_URL` (server-only), else
 * the API URL when it is absolute. A relative API URL (`/api`) points at this
 * site itself, so without `BACKEND_URL` there is nothing to proxy to and no
 * rewrite is added (it would rewrite `/api` to itself).
 */
const backendOrigin = [process.env.BACKEND_URL, rawApiUrl]
  .find((url) => url && /^https?:\/\//i.test(url))
  ?.replace(/\/$/, "")
  .replace(/\/api$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return backendOrigin
      ? [
          {
            source: "/api/:path*",
            destination: `${backendOrigin}/api/:path*`,
          },
        ]
      : [];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;

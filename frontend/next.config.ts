import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import type { NextConfig } from "next";

// The only place BACKEND_URL is read (codebase §3). Never echo the value.
const DEFAULT_BACKEND_URL = "http://127.0.0.1:4000";

function backendUrl(): string {
  const raw = process.env.BACKEND_URL?.trim() || DEFAULT_BACKEND_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("BACKEND_URL is not a valid URL. Expected something like http://127.0.0.1:4000");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BACKEND_URL must start with http:// or https://");
  }
  return url.origin;
}

const nextConfig: NextConfig = {
  // Docker image (design N2b): `next build` also emits a self-contained server in .next/standalone.
  output: "standalone",
  // node_modules is hoisted to the repo root, so trace from there; server.js lands in standalone/frontend/.
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  // `next dev` otherwise writes a frontend/AGENTS.md; agent rules live in the root AGENTS.md.
  agentRules: false,
  // No floating Next.js badge in the corner while developing.
  devIndicators: false,
  // The browser calls /api/* on the frontend origin; Next forwards it to the backend. No CORS.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backendUrl()}/api/:path*` }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);

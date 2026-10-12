import type { NextConfig } from "next";
import {
  BASE_SECURITY_HEADERS,
  FRAME_DENY_HEADERS,
} from "./lib/server/security-headers";

const nextConfig: NextConfig = {
  distDir: ".next-vercel",
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...BASE_SECURITY_HEADERS, ...FRAME_DENY_HEADERS].map(
          ([key, value]) => ({ key, value }),
        ),
      },
    ];
  },
};

export default nextConfig;

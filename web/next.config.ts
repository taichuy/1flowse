import path from "node:path";

import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";

import {
  applyNextDevWatchOptions,
  NEXT_DEV_ALLOWED_ORIGINS
} from "./lib/next-dev-runtime-config";

type NextConfigWithDevOrigins = NextConfig & {
  allowedDevOrigins?: string[];
};

function resolveApiProxyTarget() {
  return (
    process.env.SEVENFLOWS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  ).replace(/\/+$/, "");
}

export default function createNextConfig(phase: string): NextConfigWithDevOrigins {
  const isProductionPhase =
    phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER;

  return {
    ...(isProductionPhase ? { outputFileTracingRoot: path.resolve(__dirname, "..") } : {}),
    allowedDevOrigins: NEXT_DEV_ALLOWED_ORIGINS,
    turbopack: {
      root: path.resolve(__dirname, "..")
    },
    images: {
      maximumDiskCacheSize: 0
    },
    async rewrites() {
      if (isProductionPhase) {
        return [];
      }

      const apiProxyTarget = resolveApiProxyTarget();

      return [
        {
          source: "/api/:path*",
          destination: `${apiProxyTarget}/api/:path*`
        },
        {
          source: "/v1/:path*",
          destination: `${apiProxyTarget}/v1/:path*`
        }
      ];
    },
    webpack: (config, { dev }) => {
      if (dev) {
        applyNextDevWatchOptions(config);
      }

      return config;
    }
  };
}

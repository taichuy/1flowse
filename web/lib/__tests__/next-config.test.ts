import { afterEach, describe, expect, it } from "vitest";

import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } from "next/constants";

import createNextConfig from "../../next.config";

describe("createNextConfig", () => {
  const originalSevenFlowsApiUrl = process.env.SEVENFLOWS_API_URL;
  const originalPublicApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalSevenFlowsApiUrl === undefined) {
      delete process.env.SEVENFLOWS_API_URL;
    } else {
      process.env.SEVENFLOWS_API_URL = originalSevenFlowsApiUrl;
    }

    if (originalPublicApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalPublicApiUrl;
    }
  });

  it("adds same-origin /api and /v1 rewrites during dev", async () => {
    process.env.SEVENFLOWS_API_URL = "http://api.test/";

    const config = createNextConfig(PHASE_DEVELOPMENT_SERVER);

    expect(await config.rewrites?.()).toEqual([
      {
        source: "/api/:path*",
        destination: "http://api.test/api/:path*"
      },
      {
        source: "/v1/:path*",
        destination: "http://api.test/v1/:path*"
      }
    ]);
  });

  it("skips gateway rewrites in production phases", async () => {
    process.env.SEVENFLOWS_API_URL = "http://api.test";

    const config = createNextConfig(PHASE_PRODUCTION_SERVER);

    expect(await config.rewrites?.()).toEqual([]);
  });
});

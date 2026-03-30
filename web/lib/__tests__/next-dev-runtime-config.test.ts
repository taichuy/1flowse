import { describe, expect, it } from "vitest";

import {
  applyNextDevWatchOptions,
  NEXT_DEV_ALLOWED_ORIGINS,
  NEXT_DEV_WATCH_IGNORED
} from "@/lib/next-dev-runtime-config";

describe("next-dev-runtime-config", () => {
  it("暴露本地开发常见 host 白名单", () => {
    expect(NEXT_DEV_ALLOWED_ORIGINS).toEqual(
      expect.arrayContaining(["localhost", "127.0.0.1", "192.168.*.*", "10.*.*.*"])
    );
  });

  it("为 next dev 注入轮询 watch 配置并忽略高噪音目录", () => {
    const config = applyNextDevWatchOptions({
      watchOptions: {
        aggregateTimeout: 120,
        ignored: ["**/coverage/**"],
        poll: true
      }
    });

    expect(config.watchOptions).toEqual({
      aggregateTimeout: 120,
      ignored: NEXT_DEV_WATCH_IGNORED,
      poll: 1000
    });
  });

  it("在缺省配置下补齐最小 watchOptions", () => {
    const config = applyNextDevWatchOptions<{
      watchOptions?: {
        aggregateTimeout?: number;
        ignored?: string[];
        poll?: boolean | number;
      };
    }>({});

    expect(config.watchOptions).toEqual({
      aggregateTimeout: 300,
      ignored: NEXT_DEV_WATCH_IGNORED,
      poll: 1000
    });
  });
});

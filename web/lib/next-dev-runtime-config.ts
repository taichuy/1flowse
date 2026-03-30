export const NEXT_DEV_ALLOWED_ORIGINS = [
  "localhost",
  "127.0.0.1",
  "192.168.*.*",
  "10.*.*.*",
  "172.16.*.*",
  "172.17.*.*",
  "172.18.*.*",
  "172.19.*.*",
  "172.20.*.*",
  "172.21.*.*",
  "172.22.*.*",
  "172.23.*.*",
  "172.24.*.*",
  "172.25.*.*",
  "172.26.*.*",
  "172.27.*.*",
  "172.28.*.*",
  "172.29.*.*",
  "172.30.*.*",
  "172.31.*.*"
];

export const NEXT_DEV_WATCH_IGNORED = [
  "**/.git/**",
  "**/.next/**",
  "**/tmp/**",
  "**/uploads/**"
];

type WatchOptionsLike = {
  aggregateTimeout?: number;
  ignored?: unknown;
  poll?: boolean | number;
};

type WebpackConfigLike = {
  watchOptions?: WatchOptionsLike;
};

export function applyNextDevWatchOptions<T extends WebpackConfigLike>(config: T): T {
  const watchOptions = config.watchOptions ?? {};

  config.watchOptions = {
    ...watchOptions,
    aggregateTimeout: watchOptions.aggregateTimeout ?? 300,
    ignored: NEXT_DEV_WATCH_IGNORED,
    poll: typeof watchOptions.poll === "number" ? watchOptions.poll : 1000
  };

  return config;
}

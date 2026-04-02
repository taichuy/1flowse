type ApiBaseUrlOptions = {
  browserMode?: "backend-direct" | "same-origin";
};

function resolveConfiguredApiBaseUrl() {
  const configuredBaseUrl =
    process.env.SEVENFLOWS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000";

  return configuredBaseUrl.replace(/\/+$/, "");
}

export function getApiBaseUrl(options: ApiBaseUrlOptions = {}) {
  if (options.browserMode === "same-origin" && typeof window !== "undefined") {
    return "";
  }

  return resolveConfiguredApiBaseUrl();
}

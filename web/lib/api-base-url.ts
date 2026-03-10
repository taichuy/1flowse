export function getApiBaseUrl() {
  return (
    process.env.SEVENFLOWS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000"
  );
}

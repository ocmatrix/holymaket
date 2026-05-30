export const DEFAULT_INDEXER_API_BASE_URL = "http://localhost:4000";

export function getIndexerApiBaseUrl(): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL ||
    DEFAULT_INDEXER_API_BASE_URL;

  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

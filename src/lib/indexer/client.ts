import { getIndexerApiBaseUrl } from "./config.ts";
import type {
  IndexerClaim,
  IndexerHealth,
  IndexerMarket,
  IndexerTrade,
  IndexerUserPosition,
} from "./types.ts";

export class IndexerRequestError extends Error {
  status?: number;
  isUnavailable: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      isUnavailable?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "IndexerRequestError";
    this.status = options.status;
    this.isUnavailable = options.isUnavailable ?? false;
  }
}

function buildIndexerUrl(path: string): string {
  return `${getIndexerApiBaseUrl()}${path}`;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

async function parseErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const data = await response.json();

    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      return data.error;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function fetchIndexer<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(buildIndexerUrl(path), {
      cache: "no-store",
    });
  } catch {
    throw new IndexerRequestError("Indexer data unavailable", {
      isUnavailable: true,
    });
  }

  if (!response.ok) {
    const message =
      response.status >= 500
        ? "Indexer data unavailable"
        : (await parseErrorMessage(response)) || "Failed to fetch indexer data";

    throw new IndexerRequestError(message, {
      status: response.status,
      isUnavailable: response.status >= 500,
    });
  }

  return (await response.json()) as T;
}

export function isIndexerUnavailableError(error: unknown): boolean {
  return error instanceof IndexerRequestError && error.isUnavailable;
}

export async function getIndexerHealth(): Promise<IndexerHealth> {
  return fetchIndexer<IndexerHealth>("/health");
}

export async function getMarkets(): Promise<IndexerMarket[]> {
  return fetchIndexer<IndexerMarket[]>("/markets");
}

export async function getMarket(marketAddress: string): Promise<IndexerMarket> {
  return fetchIndexer<IndexerMarket>(
    `/markets/${normalizeAddress(marketAddress)}`
  );
}

export async function getMarketTrades(
  marketAddress: string
): Promise<IndexerTrade[]> {
  return fetchIndexer<IndexerTrade[]>(
    `/markets/${normalizeAddress(marketAddress)}/trades`
  );
}

export async function getUserPositions(
  address: string
): Promise<IndexerUserPosition[]> {
  return fetchIndexer<IndexerUserPosition[]>(
    `/users/${normalizeAddress(address)}/positions`
  );
}

export async function getUserTrades(address: string): Promise<IndexerTrade[]> {
  return fetchIndexer<IndexerTrade[]>(
    `/users/${normalizeAddress(address)}/trades`
  );
}

export async function getUserClaims(address: string): Promise<IndexerClaim[]> {
  return fetchIndexer<IndexerClaim[]>(
    `/users/${normalizeAddress(address)}/claims`
  );
}

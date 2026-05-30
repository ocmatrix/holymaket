import { useQuery } from "@tanstack/react-query";

import {
  getIndexerHealth,
  getMarket,
  getMarkets,
  getMarketTrades,
  getUserClaims,
  getUserPositions,
  getUserTrades,
} from "./client";

export function useIndexerHealth() {
  return useQuery({
    queryKey: ["indexer", "health"],
    queryFn: getIndexerHealth,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useIndexerMarkets() {
  return useQuery({
    queryKey: ["indexer", "markets"],
    queryFn: getMarkets,
    refetchInterval: 30000,
    retry: false,
  });
}

export function useIndexerMarket(marketAddress?: string) {
  return useQuery({
    queryKey: ["indexer", "market", marketAddress?.toLowerCase()],
    queryFn: () => getMarket(marketAddress!),
    enabled: Boolean(marketAddress),
    refetchInterval: 30000,
    retry: false,
  });
}

export function useIndexerMarketTrades(marketAddress?: string) {
  return useQuery({
    queryKey: ["indexer", "marketTrades", marketAddress?.toLowerCase()],
    queryFn: () => getMarketTrades(marketAddress!),
    enabled: Boolean(marketAddress),
    refetchInterval: 30000,
    retry: false,
  });
}

export function useIndexerUserPositions(address?: string) {
  return useQuery({
    queryKey: ["indexer", "userPositions", address?.toLowerCase()],
    queryFn: () => getUserPositions(address!),
    enabled: Boolean(address),
    refetchInterval: 30000,
    retry: false,
  });
}

export function useIndexerUserTrades(address?: string) {
  return useQuery({
    queryKey: ["indexer", "userTrades", address?.toLowerCase()],
    queryFn: () => getUserTrades(address!),
    enabled: Boolean(address),
    refetchInterval: 30000,
    retry: false,
  });
}

export function useIndexerUserClaims(address?: string) {
  return useQuery({
    queryKey: ["indexer", "userClaims", address?.toLowerCase()],
    queryFn: () => getUserClaims(address!),
    enabled: Boolean(address),
    refetchInterval: 30000,
    retry: false,
  });
}

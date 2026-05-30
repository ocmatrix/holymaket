import { getAddress } from "viem";

export function normalizeAddress(address: string): string {
  return getAddress(address).toLowerCase();
}

export function normalizeOptionalAddress(address?: string | null): string | null {
  if (address === null || address === undefined) {
    return null;
  }

  return normalizeAddress(address);
}

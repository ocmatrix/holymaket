import { normalizeAddress } from "../../lib/address.js";

export function serializeAddress(address: string): string {
  return normalizeAddress(address);
}

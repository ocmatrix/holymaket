import { getAddress } from "viem";

const MARKET_FACTORY = getAddress(
  "0x45ab369f65c0ef44c1325323f283e6acc92b8bd0"
);

const CPMM_ENGINE = getAddress(
  "0x16fae185a854a54307f6dea9c0d53e326bb4f82f"
);

const STANDALONE_MARKET = getAddress(
  "0x05caa8a264b2436f1851a58f4f183350fd330a2f"
);

const MOCK_USDT = getAddress(
  "0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB"
);

const SMOKE_TEST_MARKET = getAddress(
  "0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07"
);

export const CONTRACTS = {
  MARKET_FACTORY,
  CPMM_ENGINE,
  STANDALONE_MARKET,
  MOCK_USDT,
  SMOKE_TEST_MARKET,
} as const;

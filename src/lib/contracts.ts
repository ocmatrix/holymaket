export const XMARKET_CHAIN_ID = 97;

export const XMARKET_CONTRACTS = {
    marketFactory: '0x45ab369f65c0ef44c1325323f283e6acc92b8bd0',
    cpmmEngine: '0x16fae185a854a54307f6dea9c0d53e326bb4f82f',
    standaloneMarket: '0x05caa8a264b2436f1851a58f4f183350fd330a2f',
    mockUSDT: '0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB',
    smokeTestMarket: '0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07',
} as const;

export const XMARKET_NETWORK = {
    name: 'BSC Testnet',
    rpcUrl: process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
} as const;

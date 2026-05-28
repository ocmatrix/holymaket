import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { mainnet, arbitrum, optimism, polygon, bsc } from 'viem/chains';
const RPC_ENDPOINTS = {
    mainnet: process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://rpc.ankr.com/eth',
    arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://rpc.ankr.com/arbitrum',
    polygon: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://rpc.ankr.com/polygon',
    optimism: process.env.NEXT_PUBLIC_OPTIMISM_RPC || 'https://rpc.ankr.com/optimism',
    bsc: process.env.NEXT_PUBLIC_BSC_RPC || 'https://bsc-dataseed.binance.org',
};
export const config = getDefaultConfig({
    appName: 'Superoctop Hub',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    chains: [bsc, mainnet, arbitrum, optimism, polygon],
    transports: {
        [mainnet.id]: http(RPC_ENDPOINTS.mainnet),
        [arbitrum.id]: http(RPC_ENDPOINTS.arbitrum),
        [polygon.id]: http(RPC_ENDPOINTS.polygon),
        [optimism.id]: http(RPC_ENDPOINTS.optimism),
        [bsc.id]: http(RPC_ENDPOINTS.bsc),
    },
    ssr: true,
});

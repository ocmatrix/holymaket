import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { mainnet, arbitrum, optimism, polygon, bscTestnet } from 'viem/chains';
import { XMARKET_NETWORK } from './contracts';

const RPC_ENDPOINTS = {
    bscTestnet: XMARKET_NETWORK.rpcUrl,
    mainnet: process.env.NEXT_PUBLIC_MAINNET_RPC || 'https://rpc.ankr.com/eth',
    arbitrum: process.env.NEXT_PUBLIC_ARBITRUM_RPC || 'https://rpc.ankr.com/arbitrum',
    polygon: process.env.NEXT_PUBLIC_POLYGON_RPC || 'https://rpc.ankr.com/polygon',
    optimism: process.env.NEXT_PUBLIC_OPTIMISM_RPC || 'https://rpc.ankr.com/optimism',
};

export const config = getDefaultConfig({
    appName: 'Superoctop Hub',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    chains: [bscTestnet, mainnet, arbitrum, optimism, polygon],
    transports: {
        [bscTestnet.id]: http(RPC_ENDPOINTS.bscTestnet),
        [mainnet.id]: http(RPC_ENDPOINTS.mainnet),
        [arbitrum.id]: http(RPC_ENDPOINTS.arbitrum),
        [polygon.id]: http(RPC_ENDPOINTS.polygon),
        [optimism.id]: http(RPC_ENDPOINTS.optimism),
    },
    ssr: true,
});

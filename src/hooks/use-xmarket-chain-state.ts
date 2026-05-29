"use client";

import { useMemo } from "react";
import { useWallets } from "@privy-io/react-auth";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { marketFactoryAbi } from "@/lib/contract-abis";
import { XMARKET_CHAIN_ID, XMARKET_CONTRACTS } from "@/lib/contracts";

function formatError(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }
    return undefined;
}

export function useXMarketChainState() {
    const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
    const chainId = useChainId();
    const { wallets } = useWallets();

    const privyAddress = wallets[0]?.address as `0x${string}` | undefined;
    const address = wagmiAddress ?? privyAddress;
    const isConnected = wagmiConnected || Boolean(privyAddress);
    const isCorrectNetwork = chainId === XMARKET_CHAIN_ID;

    const factoryAmmEngineQuery = useReadContract({
        abi: marketFactoryAbi,
        address: XMARKET_CONTRACTS.marketFactory,
        functionName: "ammEngine",
        chainId: XMARKET_CHAIN_ID,
    });

    const factoryNextMarketIdQuery = useReadContract({
        abi: marketFactoryAbi,
        address: XMARKET_CONTRACTS.marketFactory,
        functionName: "nextMarketId",
        chainId: XMARKET_CHAIN_ID,
    });

    const mockUsdtNameQuery = useReadContract({
        abi: erc20Abi,
        address: XMARKET_CONTRACTS.mockUSDT,
        functionName: "name",
        chainId: XMARKET_CHAIN_ID,
    });

    const mockUsdtSymbolQuery = useReadContract({
        abi: erc20Abi,
        address: XMARKET_CONTRACTS.mockUSDT,
        functionName: "symbol",
        chainId: XMARKET_CHAIN_ID,
    });

    const mockUsdtDecimalsQuery = useReadContract({
        abi: erc20Abi,
        address: XMARKET_CONTRACTS.mockUSDT,
        functionName: "decimals",
        chainId: XMARKET_CHAIN_ID,
    });

    const mockUsdtBalanceQuery = useReadContract({
        abi: erc20Abi,
        address: XMARKET_CONTRACTS.mockUSDT,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        chainId: XMARKET_CHAIN_ID,
        query: {
            enabled: Boolean(address),
        },
    });

    const error = useMemo(() => {
        return [
            factoryAmmEngineQuery.error,
            factoryNextMarketIdQuery.error,
            mockUsdtNameQuery.error,
            mockUsdtSymbolQuery.error,
            mockUsdtDecimalsQuery.error,
            mockUsdtBalanceQuery.error,
        ].map(formatError).find(Boolean);
    }, [
        factoryAmmEngineQuery.error,
        factoryNextMarketIdQuery.error,
        mockUsdtNameQuery.error,
        mockUsdtSymbolQuery.error,
        mockUsdtDecimalsQuery.error,
        mockUsdtBalanceQuery.error,
    ]);

    const rawMockUsdtBalance = mockUsdtBalanceQuery.data;
    const mockUsdtDecimals = mockUsdtDecimalsQuery.data;
    const formattedMockUsdtBalance = typeof rawMockUsdtBalance === "bigint" && mockUsdtDecimals != null
        ? formatUnits(rawMockUsdtBalance, mockUsdtDecimals)
        : undefined;

    return {
        chainId,
        isConnected,
        address,
        factoryAmmEngine: factoryAmmEngineQuery.data,
        factoryNextMarketId: factoryNextMarketIdQuery.data,
        mockUsdtName: mockUsdtNameQuery.data,
        mockUsdtSymbol: mockUsdtSymbolQuery.data,
        mockUsdtDecimals,
        mockUsdtBalance: rawMockUsdtBalance,
        formattedMockUsdtBalance,
        isCorrectNetwork,
        loading: factoryAmmEngineQuery.isLoading ||
            factoryNextMarketIdQuery.isLoading ||
            mockUsdtNameQuery.isLoading ||
            mockUsdtSymbolQuery.isLoading ||
            mockUsdtDecimalsQuery.isLoading ||
            mockUsdtBalanceQuery.isLoading,
        error,
    };
}

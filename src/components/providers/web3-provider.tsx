"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '../../lib/wagmi';
import { bsc } from 'viem/chains';
import '@rainbow-me/rainbowkit/styles.css';
import { ErrorBoundary } from "react-error-boundary";
const rainbowTheme = darkTheme({
    accentColor: '#8a2be2',
    accentColorForeground: 'white',
    borderRadius: 'large',
    overlayBlur: 'small',
});
let globalQueryClient: QueryClient | null = null;
const getQueryClient = () => {
    if (typeof window === "undefined")
        return new QueryClient();
    if (!globalQueryClient) {
        globalQueryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    staleTime: 1000 * 60 * 5,
                    gcTime: 1000 * 60 * 30,
                    retry: 1,
                    refetchOnWindowFocus: false,
                },
            },
        });
    }
    return globalQueryClient;
};
function Web3ErrorFallback({ error, resetErrorBoundary }: {
    error: Error;
    resetErrorBoundary: () => void;
}) {
    return (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
      <p>Web3 Provider Error: {error.message}</p>
      <button onClick={resetErrorBoundary} className="mt-2 text-xs underline hover:no-underline">
        Try again
      </button>
    </div>);
}
export function Web3Provider({ children }: {
    children: React.ReactNode;
}) {
    const queryClientRef = useRef<QueryClient | null>(null);
    if (!queryClientRef.current) {
        queryClientRef.current = getQueryClient();
    }
    return (<ErrorBoundary FallbackComponent={Web3ErrorFallback}>
      <WagmiProvider config={config} reconnectOnMount={true}>
        <QueryClientProvider client={queryClientRef.current}>
          <RainbowKitProvider theme={rainbowTheme} initialChain={bsc}>
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>);
}

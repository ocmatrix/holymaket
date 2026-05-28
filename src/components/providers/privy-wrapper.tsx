"use client";
import { PrivyProvider } from '@privy-io/react-auth';
import { mainnet, arbitrum, optimism, polygon, bsc } from 'viem/chains';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { Component, type ReactNode } from 'react';
function isSecureContext(): boolean {
    if (typeof window === 'undefined')
        return true;
    return window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
}
interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}
class PrivyErrorBoundary extends Component<{
    children: ReactNode;
}, ErrorBoundaryState> {
    constructor(props: {
        children: ReactNode;
    }) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }
    render() {
        if (this.state.hasError) {
            console.warn('[PrivyWrapper] Privy initialization failed, continuing without Privy:', this.state.error?.message);
            return this.props.children;
        }
        return this.props.children;
    }
}
function PrivyProviderInner({ children }: {
    children: ReactNode;
}) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmkgl3ppv04scjy0cbvjco4h1";
    const isSecure = isSecureContext();
    const solanaConnectors = toSolanaWalletConnectors({
        shouldAutoConnect: false,
    });
    return (<PrivyProvider appId={appId} config={{
            loginMethods: ['wallet', 'email', 'google', 'twitter', 'discord'],
            appearance: {
                theme: 'dark',
                accentColor: '#8a2be2',
                showWalletLoginFirst: true,
                logo: '/octopus-logo.png',
            },
            embeddedWallets: isSecure ? {
                ethereum: {
                    createOnLogin: 'users-without-wallets',
                },
            } : {
                ethereum: {
                    createOnLogin: 'off',
                },
            },
            defaultChain: bsc,
            supportedChains: [bsc, mainnet, arbitrum, optimism, polygon],
            externalWallets: {
                solana: {
                    connectors: solanaConnectors,
                },
            },
            walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        }}>
      {children}
    </PrivyProvider>);
}
export function PrivyWrapper({ children }: {
    children: ReactNode;
}) {
    return (<PrivyErrorBoundary>
      <PrivyProviderInner>{children}</PrivyProviderInner>
    </PrivyErrorBoundary>);
}

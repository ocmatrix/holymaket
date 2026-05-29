"use client";

import { useXMarketChainState } from "@/hooks/use-xmarket-chain-state";
import { XMARKET_CHAIN_ID, XMARKET_CONTRACTS, XMARKET_NETWORK } from "@/lib/contracts";

interface C10PredictionPanelProps {
    market?: {
        id: string;
        title?: string | null;
        category?: string | null;
        status?: string | null;
    } | null;
}

export function C10PredictionPanel({ market }: C10PredictionPanelProps) {
    const {
        address,
        error,
        factoryAmmEngine,
        factoryNextMarketId,
        formattedMockUsdtBalance,
        isConnected,
        loading,
        mockUsdtDecimals,
        mockUsdtName,
        mockUsdtSymbol,
    } = useXMarketChainState();

    return (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#111] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">
                        XMarket BSC Testnet Status
                    </h3>
                    <p className="mt-2 text-xs text-white/45 leading-relaxed">
                        Minimum chain read integration for PR-17 Stage 2. Read-only state only, no buy/sell/claim actions.
                    </p>
                </div>
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-300">
                    {loading ? "Loading" : "Read Only"}
                </span>
            </div>

            <div className="space-y-3 text-xs text-white/70">
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Network</p>
                    <p className="mt-2 font-semibold text-white">{XMARKET_NETWORK.name}</p>
                    <p className="mt-1 text-white/55">Chain ID: {XMARKET_CHAIN_ID}</p>
                    <p className="mt-1 text-white/55">Wallet: {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">MarketFactory</p>
                    <p className="mt-2 break-all text-white/60">{XMARKET_CONTRACTS.marketFactory}</p>
                    <p className="mt-2 text-white/55">factory.ammEngine(): <span className="break-all text-white">{factoryAmmEngine || "Loading..."}</span></p>
                    <p className="mt-1 text-white/55">factory.nextMarketId(): <span className="text-white">{factoryNextMarketId != null ? String(factoryNextMarketId) : "Loading..."}</span></p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">MockUSDT</p>
                    <p className="mt-2 break-all text-white/60">{XMARKET_CONTRACTS.mockUSDT}</p>
                    <p className="mt-2 text-white/55">name: <span className="text-white">{mockUsdtName || "Loading..."}</span></p>
                    <p className="mt-1 text-white/55">symbol: <span className="text-white">{mockUsdtSymbol || "Loading..."}</span></p>
                    <p className="mt-1 text-white/55">decimals: <span className="text-white">{mockUsdtDecimals != null ? String(mockUsdtDecimals) : "Loading..."}</span></p>
                    <p className="mt-1 text-white/55">Your mUSDT balance: <span className="text-white">{isConnected ? (formattedMockUsdtBalance || "Loading...") : "Not connected"}</span></p>
                </div>

                {market?.id && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-white/55">
                        Current page market: <span className="text-white">{market.title || market.id}</span>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                        Chain read error: {error}
                    </div>
                )}
            </div>
        </div>
    );
}

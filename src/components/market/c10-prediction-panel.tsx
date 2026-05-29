"use client";

import { useXMarketChainState } from "@/hooks/use-xmarket-chain-state";
import { useXMarketWrite } from "@/hooks/use-xmarket-write";
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
        error: readError,
        factoryAmmEngine,
        factoryNextMarketId,
        formattedMockUsdtBalance,
        isConnected,
        isCorrectNetwork,
        loading: readLoading,
        mockUsdtDecimals,
        mockUsdtName,
        mockUsdtSymbol,
        testMarketStatus,
        testMarketOutcome,
    } = useXMarketChainState();

    const {
        hash,
        isPending,
        isSuccess,
        error: writeError,
        approveUsdt,
        buy,
        sell,
        claim,
    } = useXMarketWrite();

    const handleApprove = () => approveUsdt(XMARKET_CONTRACTS.mockUSDT, XMARKET_CONTRACTS.smokeTestMarket, 1000000000n);
    const handleBuyYes = () => buy(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, true);
    const handleBuyNo = () => buy(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, false);
    const handleSellYes = () => sell(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, true);
    const handleSellNo = () => sell(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, false);
    const handleClaim = () => claim(XMARKET_CONTRACTS.smokeTestMarket);

    const error = readError || (writeError ? writeError.message : undefined);
    const isResolvedOrClosed = testMarketStatus != null && testMarketStatus >= 2;
    const isActionDisabled = !isConnected || !isCorrectNetwork || isPending;
    const isTradingDisabled = isActionDisabled || isResolvedOrClosed;

    return (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#111] p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">
                        XMarket BSC Testnet Status
                    </h3>
                    <p className="mt-2 text-xs text-white/45 leading-relaxed">
                        Minimum chain read and write integration for PR-17 Stage 3.
                    </p>
                </div>
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-300">
                    {readLoading ? "Loading" : "Read & Write"}
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
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Smoke Test Market</p>
                    <p className="mt-2 break-all text-white/60">{XMARKET_CONTRACTS.smokeTestMarket}</p>
                    <p className="mt-2 text-white/55">status(): <span className="text-white">{testMarketStatus != null ? String(testMarketStatus) : "Loading..."}</span></p>
                    <p className="mt-1 text-white/55">outcome(): <span className="text-white">{testMarketOutcome != null ? String(testMarketOutcome) : "Loading..."}</span></p>
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

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Actions (Stage 3)</p>
                    {!isConnected && (
                        <p className="mt-2 text-xs text-yellow-400/80">Please connect wallet to transact.</p>
                    )}
                    {isConnected && !isCorrectNetwork && (
                        <p className="mt-2 text-xs text-yellow-400/80">Please switch to BSC Testnet.</p>
                    )}
                    {isConnected && isCorrectNetwork && isResolvedOrClosed && (
                        <p className="mt-2 text-xs text-yellow-400/80">This test market is resolved. Trading is disabled.</p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                            onClick={handleApprove}
                            disabled={isTradingDisabled}
                            className="col-span-2 rounded bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50"
                        >
                            Approve mUSDT
                        </button>
                        <button
                            onClick={handleBuyYes}
                            disabled={isTradingDisabled}
                            className="rounded bg-green-500/20 px-3 py-2 text-xs font-semibold text-green-300 hover:bg-green-500/30 disabled:opacity-50"
                        >
                            Buy YES
                        </button>
                        <button
                            onClick={handleBuyNo}
                            disabled={isTradingDisabled}
                            className="rounded bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                        >
                            Buy NO
                        </button>
                        <button
                            onClick={handleSellYes}
                            disabled={isTradingDisabled}
                            className="rounded bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-300 border border-green-500/20 hover:bg-green-500/20 disabled:opacity-50"
                        >
                            Sell YES
                        </button>
                        <button
                            onClick={handleSellNo}
                            disabled={isTradingDisabled}
                            className="rounded bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                        >
                            Sell NO
                        </button>
                        <button
                            onClick={handleClaim}
                            disabled={isActionDisabled}
                            className="col-span-2 rounded bg-purple-500/20 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
                        >
                            Claim Winnings
                        </button>
                    </div>
                    {isPending && (
                        <p className="mt-2 text-xs text-cyan-400">Transaction pending...</p>
                    )}
                    {isSuccess && (
                        <p className="mt-2 text-xs text-green-400">Transaction successful! Hash: {hash?.slice(0,10)}...</p>
                    )}
                </div>

                {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                        Chain read error: {error}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import Link from "next/link";

import { useXMarketChainState } from "@/hooks/use-xmarket-chain-state";
import { useXMarketWrite } from "@/hooks/use-xmarket-write";
import { XMARKET_CHAIN_ID, XMARKET_CONTRACTS, XMARKET_NETWORK } from "@/lib/contracts";
import {
    useIndexerHealth,
    useIndexerMarketTrades,
    useIndexerMarkets,
    useIndexerUserPositions,
} from "@/lib/indexer/hooks";
import { isIndexerUnavailableError } from "@/lib/indexer/client";

interface C10PredictionPanelProps {
    market?: {
        id: string;
        title?: string | null;
        category?: string | null;
        status?: string | null;
    } | null;
}

export function C10PredictionPanel({ market }: C10PredictionPanelProps) {
    const smokeMarketAddress = XMARKET_CONTRACTS.smokeTestMarket.toLowerCase();
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

    const {
        data: indexerHealth,
        isLoading: indexerHealthLoading,
        error: indexerHealthError,
    } = useIndexerHealth();
    const {
        data: indexerMarkets,
        isLoading: indexerMarketsLoading,
        error: indexerMarketsError,
    } = useIndexerMarkets();
    const indexerMarket = indexerMarkets?.find((item) => item.marketAddress === smokeMarketAddress) || indexerMarkets?.[0];
    const {
        data: indexerTrades,
        isLoading: indexerTradesLoading,
        error: indexerTradesError,
    } = useIndexerMarketTrades(indexerMarket?.marketAddress || smokeMarketAddress);
    const {
        data: indexerUserPositions,
        isLoading: indexerUserPositionsLoading,
        error: indexerUserPositionsError,
    } = useIndexerUserPositions(address);
    const currentIndexedPosition = indexerUserPositions?.find((item) => item.marketAddress === smokeMarketAddress);
    const latestIndexedTrade = indexerTrades?.[0];
    const indexerUnavailable = [
        indexerHealthError,
        indexerMarketsError,
        indexerTradesError,
        indexerUserPositionsError,
    ].some(isIndexerUnavailableError);
    const indexerErrors = [
        indexerHealthError,
        indexerMarketsError,
        indexerTradesError,
        indexerUserPositionsError,
    ].filter(Boolean);

    const handleApprove = () => approveUsdt(XMARKET_CONTRACTS.mockUSDT, XMARKET_CONTRACTS.smokeTestMarket, 1000000000n);
    const handleBuyYes = () => buy(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, true);
    const handleBuyNo = () => buy(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, false);
    const handleSellYes = () => sell(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, true);
    const handleSellNo = () => sell(XMARKET_CONTRACTS.smokeTestMarket, 1000000n, 0n, false);
    const handleClaim = () => claim(XMARKET_CONTRACTS.smokeTestMarket);

    const error = readError || (writeError ? writeError.message : undefined);
    const numericMarketStatus = typeof testMarketStatus === "bigint"
        ? Number(testMarketStatus)
        : typeof testMarketStatus === "number"
            ? testMarketStatus
            : -1;
    const isResolvedOrClosed = numericMarketStatus >= 2;
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
                    <p className="mt-2 text-white/55">factory.ammEngine(): <span className="break-all text-white">{factoryAmmEngine != null ? String(factoryAmmEngine) : "Loading..."}</span></p>
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

                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexer Read API</p>
                            <p className="mt-2 text-white/55">Only display data is read from the indexer. Trading remains on-chain.</p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${indexerUnavailable
                                ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                                : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"}`}>
                            {indexerHealthLoading ? "Checking" : indexerUnavailable ? "Unavailable" : (indexerHealth?.status || "Ready")}
                        </span>
                    </div>

                    {indexerUnavailable ? (<div className="mt-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                        <p>Indexer data unavailable</p>
                        <p className="mt-1 text-yellow-200/70">On-chain trading remains available</p>
                      </div>) : indexerErrors.length > 0 ? (<div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                        {(indexerErrors[0] as Error).message}
                      </div>) : (<div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexed Market</p>
                            {indexerMarketsLoading ? (<p className="mt-2 text-xs text-white/45">Loading indexed market...</p>) : indexerMarket ? (<>
                                <p className="mt-2 break-all text-white/70">{indexerMarket.marketAddress}</p>
                                <p className="mt-2 text-white/55">status: <span className="text-white">{indexerMarket.status}</span></p>
                                <p className="mt-1 text-white/55">outcome: <span className="text-white">{indexerMarket.outcome}</span></p>
                                <p className="mt-1 text-white/55">marketId: <span className="text-white">{indexerMarket.marketId}</span></p>
                            </>) : (<p className="mt-2 text-xs text-white/45">No indexed markets yet</p>)}
                        </div>

                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexed Trades</p>
                            {indexerTradesLoading ? (<p className="mt-2 text-xs text-white/45">Loading indexed trades...</p>) : indexerTrades && indexerTrades.length > 0 ? (<>
                                <p className="mt-2 text-white/55">trade count: <span className="text-white">{indexerTrades.length}</span></p>
                                <p className="mt-1 text-white/55">latest block: <span className="text-white">{latestIndexedTrade?.blockNumber || "—"}</span></p>
                                <p className="mt-1 text-white/55">latest tx: <span className="break-all text-white">{latestIndexedTrade?.txHash || "—"}</span></p>
                                <p className="mt-1 text-white/55">latest data: <span className="text-white">{latestIndexedTrade?.blockTimestamp || "Indexed"}</span></p>
                            </>) : (<p className="mt-2 text-xs text-white/45">No indexed trades yet</p>)}
                        </div>
                      </div>)}

                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">My Indexed Position</p>
                        {!address ? (<p className="mt-2 text-xs text-white/45">Connect wallet to view indexed positions</p>) : indexerUserPositionsLoading ? (<p className="mt-2 text-xs text-white/45">Loading indexed position...</p>) : currentIndexedPosition ? (<>
                            <p className="mt-2 text-white/55">YES shares: <span className="text-white">{currentIndexedPosition.yesShares}</span></p>
                            <p className="mt-1 text-white/55">NO shares: <span className="text-white">{currentIndexedPosition.noShares}</span></p>
                            <p className="mt-1 text-white/55">claimed: <span className="text-white">{String(currentIndexedPosition.claimed)}</span></p>
                            <p className="mt-1 text-white/55">refunded: <span className="text-white">{String(currentIndexedPosition.refunded)}</span></p>
                        </>) : (<p className="mt-2 text-xs text-white/45">No indexed position for this market yet</p>)}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/market/${smokeMarketAddress}`} className="rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20">
                            Open Indexed Market Detail
                        </Link>
                    </div>
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

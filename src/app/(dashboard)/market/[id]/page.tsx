"use client";
import { use } from "react";
import Link from "next/link";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import { useLanguageStore } from "../../../../stores/language-store";
import { translations } from "../../../../lib/translations";
import { XMARKET_CONTRACTS } from "../../../../lib/contracts";
import {
    useIndexerMarket,
    useIndexerMarketTrades,
} from "../../../../lib/indexer/hooks";
import { isIndexerUnavailableError } from "../../../../lib/indexer/client";
type MarketDetailPageProps = {
    params: Promise<{
        id: string;
    }>;
};

function isEvmAddress(value: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export default function MarketDetailPage({ params }: MarketDetailPageProps) {
    const resolvedParams = use(params);
    const { currentLanguage } = useLanguageStore();
    const t = translations[currentLanguage] || translations["en"];
    const marketAddress = isEvmAddress(resolvedParams.id)
        ? resolvedParams.id.toLowerCase()
        : XMARKET_CONTRACTS.smokeTestMarket.toLowerCase();
    const usingFallbackMarket = marketAddress !== resolvedParams.id.toLowerCase();
    const { data: market, isLoading, error } = useIndexerMarket(marketAddress);
    const {
        data: trades,
        isLoading: isTradesLoading,
        error: tradesError,
    } = useIndexerMarketTrades(marketAddress);
    const isUnavailable = isIndexerUnavailableError(error) || isIndexerUnavailableError(tradesError);
    return (<div className="relative overflow-hidden px-6 pb-24 pt-10 md:px-12 lg:px-20">
      <div className="mb-6 text-sm text-white/50">
        <Link href="/market" className="hover:text-white">
          ← {t.marketDetail.backToMarket}
        </Link>
      </div>

      <div className="glass rounded-3xl p-8">
        {usingFallbackMarket && (<div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            Route parameter is not a market address. Showing the smoke test market indexer detail instead.
          </div>)}
        {isUnavailable && (<div className="mb-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
            <p>Indexer data unavailable</p>
            <p className="mt-1 text-yellow-200/70">On-chain trading remains available</p>
          </div>)}
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">
          {isLoading ? "Loading..." : market?.status}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          {isLoading ? <Skeleton className="h-8 w-64"/> : (market?.question || market?.marketAddress)}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Indexed market address: {isLoading ? "Loading..." : market?.marketAddress}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/40">Market Status</p>
            <p className="mt-2 text-xl font-semibold">
              {isLoading ? <Skeleton className="h-6 w-20"/> : (market?.status || "—")}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/40">Outcome</p>
            <p className="mt-2 text-xl font-semibold">
              {isLoading ? <Skeleton className="h-6 w-12"/> : (market?.outcome || "Unresolved")}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/40">Trade Count</p>
            <p className="mt-2 text-xl font-semibold">
              {isTradesLoading ? <Skeleton className="h-6 w-12"/> : (trades?.length || 0)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Indexed Market Metadata</p>
              {isLoading ? (<div className="mt-3 space-y-2">
                  <Skeleton className="h-4 w-full"/>
                  <Skeleton className="h-4 w-4/5"/>
                  <Skeleton className="h-4 w-2/3"/>
                </div>) : market ? (<div className="mt-3 space-y-2 break-all">
                  <p>Market ID: {market.marketId}</p>
                  <p>Created Block: {market.createdBlockNumber || "—"}</p>
                  <p>Created Tx: {market.createdTxHash || "—"}</p>
                  <p>Resolved Block: {market.resolvedBlockNumber || "—"}</p>
                  <p>Resolved Tx: {market.resolvedTxHash || "—"}</p>
                </div>) : (<p className="mt-3 text-white/40">No indexed market found</p>)}
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neon-purple/5 p-4 text-sm text-white/70">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon-purple-bright">
                Indexed Trades
              </p>
              {isTradesLoading ? (<div className="mt-3 space-y-2">
                  <Skeleton className="h-10 w-full"/>
                  <Skeleton className="h-10 w-full"/>
                  <Skeleton className="h-10 w-full"/>
                </div>) : tradesError && !isUnavailable ? (<p className="mt-3 text-red-300">{(tradesError as Error).message}</p>) : trades && trades.length > 0 ? (<div className="mt-3 space-y-3">
                  {trades.slice(0, 8).map((trade) => (<div key={`${trade.txHash}-${trade.logIndex}`} className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-white">{trade.side} / {trade.action}</span>
                        <span className="text-white/40">#{trade.blockNumber}</span>
                      </div>
                      <p className="mt-2 text-white/60">collateralAmount: <span className="text-white">{trade.collateralAmount}</span></p>
                      <p className="mt-1 text-white/60">sharesAmount: <span className="text-white">{trade.sharesAmount}</span></p>
                      <p className="mt-1 break-all text-white/60">txHash: <span className="text-white">{trade.txHash}</span></p>
                    </div>))}
                </div>) : (<p className="mt-3 text-white/40">No indexed trades yet</p>)}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Indexer Summary</p>
            <div className="mt-4 space-y-3">
              <Link href="/market" className="block rounded-full bg-neon-purple px-5 py-2 text-center text-sm font-semibold text-white transition hover:shadow-glow-purple">
                Return To Market
              </Link>
              <Button variant="outline" className="w-full" disabled>
                {isLoading ? "Checking health..." : `Health: ${isUnavailable ? "Unavailable" : "OK"}`}
              </Button>
              <Button variant="ghost" className="w-full" disabled>
                {isTradesLoading ? "Loading latest data..." : `Latest data: ${trades?.[0]?.blockTimestamp || trades?.[0]?.blockNumber || "No indexed trades"}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>);
}

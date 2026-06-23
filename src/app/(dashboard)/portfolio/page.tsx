"use client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useLanguageStore } from "../../../stores/language-store";
import { translations } from "../../../lib/translations";
import { useAuth } from "../../../hooks/use-auth";
import { useProfile } from "../../../hooks/use-profile";
import { api } from "../../../lib/api";
import {
    useIndexerUserClaims,
    useIndexerUserPositions,
    useIndexerUserTrades,
} from "../../../lib/indexer/hooks";
import { isIndexerUnavailableError } from "../../../lib/indexer/client";
import { MarketTrend } from "../../../components/charts/market-trend";
import { ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useWallets } from "@privy-io/react-auth";
type ActivityItem = {
    id: string;
    type: string;
    title: string;
    amount: number;
    position?: string;
    status: string;
    time: string;
};
function formatActivityTime(time: string) {
    const d = new Date(time);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000)
        return "刚刚";
    if (diff < 3600000)
        return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000)
        return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toLocaleDateString();
}
function formatHash(value: string) {
    return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
export default function PortfolioPage() {
    const { user } = useAuth();
    const { wallets } = useWallets();
    const searchParams = useSearchParams();
    const { currentLanguage } = useLanguageStore();
    const t = translations[currentLanguage] || translations["en"];
    const { profile, isLoading: profileLoading } = useProfile(user?.id || "");
    const activeWallet = wallets[0];
    const previewAddress = searchParams.get("address") || undefined;
    const indexerAddress = activeWallet?.address || user?.address || previewAddress;
    const userId = user?.id || (profile as {
        id?: string;
    })?.id;
    const { data: recentActivityData, isLoading: activityLoading } = useQuery({
        queryKey: ["userRecentActivity", userId],
        queryFn: () => api.getRecentActivity(userId, 20),
        enabled: !!userId,
        staleTime: 15000,
    });
    const { data: seasonLevelData, isLoading: seasonLoading } = useQuery({
        queryKey: ["userSeasonLevel", userId],
        queryFn: () => api.getSeasonLevel(userId),
        enabled: !!userId,
        staleTime: 60000,
    });
    const { data: profitCurveData } = useQuery({
        queryKey: ["userProfitCurve", userId],
        queryFn: () => api.getProfitCurve(userId, 30),
        enabled: !!userId,
        staleTime: 60000,
    });
    const { data: indexedPositions, isLoading: indexedPositionsLoading, error: indexedPositionsError } = useIndexerUserPositions(indexerAddress);
    const { data: indexedTrades, isLoading: indexedTradesLoading, error: indexedTradesError } = useIndexerUserTrades(indexerAddress);
    const { data: indexedClaims, isLoading: indexedClaimsLoading, error: indexedClaimsError } = useIndexerUserClaims(indexerAddress);
    const activities = (recentActivityData?.activities ?? []) as ActivityItem[];
    const seasonLevel = seasonLevelData?.level ?? "—";
    const seasonRank = seasonLevelData?.rank;
    const seasonName = seasonLevelData?.seasonName;
    const curve = (profitCurveData?.curve ?? []) as {
        date: string;
        pnl: number;
        cumulativePnl: number;
    }[];
    const totalCumulativePnl = curve.length > 0 ? curve[curve.length - 1].cumulativePnl : null;
    const indexerUnavailable = [
        indexedPositionsError,
        indexedTradesError,
        indexedClaimsError,
    ].some(isIndexerUnavailableError);
    const indexerError = ([
        indexedPositionsError,
        indexedTradesError,
        indexedClaimsError,
    ].filter(Boolean)[0] || null) as Error | null;
    return (<div className="relative overflow-hidden px-6 pb-24 pt-10 md:px-12 lg:px-20">
      <div className="glass rounded-3xl p-8">
        <h1 className="text-3xl font-semibold">{t.portfolio.title}</h1>
        <p className="mt-2 text-sm text-white/60">{t.portfolio.desc}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/40">{t.portfolio.currentPoints}</p>
            <p className="mt-2 text-2xl font-semibold">
              {profileLoading ? "—" : (profile?.pts ?? profile?.points ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/40">{t.portfolio.winRate}</p>
            <p className="mt-2 text-2xl font-semibold">
              {profileLoading ? "—" : profile?.winRate ? `${(Number(profile.winRate) * 100).toFixed(1)}%` : "0%"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-xs text-white/40">{t.portfolio.seasonLevel}</p>
            <p className="mt-2 text-2xl font-semibold">
              {seasonLoading ? "—" : seasonRank != null ? `#${seasonRank} ${seasonLevel}` : seasonLevel}
            </p>
            {seasonName && (<p className="mt-1 text-[10px] text-white/30 truncate" title={seasonName}>{seasonName}</p>)}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <MarketTrend title={t.portfolio.profitCurve} value={totalCumulativePnl != null
            ? `${totalCumulativePnl >= 0 ? "+" : ""}${totalCumulativePnl.toFixed(0)} PTS`
            : "—"}/>
        <MarketTrend title={t.portfolio.exposure} value={t.portfolio.neutral}/>
      </div>

      <div className="mt-8 glass rounded-3xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck size={20} className="text-cyan-400"/>
            {t.profile?.recent || "最近活动"}
          </h2>
          <Link href="/home" className="text-xs font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300">
            返回首頁
          </Link>
        </div>
        {!userId ? (<p className="text-white/40 text-sm py-8 text-center">请先登录后查看最近活动</p>) : activityLoading ? (<div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (<div key={i} className="h-14 rounded-xl bg-white/5"/>))}
          </div>) : activities.length > 0 ? (<ul className="space-y-3">
            {activities.map((a) => (<li key={a.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white/90">{a.title}</p>
                  <p className="text-xs text-white/40">
                    {a.type} · {a.position ?? ""} · {formatActivityTime(a.time)}
                  </p>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <span className="text-sm font-black text-cyan-400">
                    {Number(a.amount).toLocaleString()} PTS
                  </span>
                  <span className={`ml-2 text-[10px] font-bold uppercase ${a.status === "WIN" || a.status === "WON"
                    ? "text-green-400"
                    : a.status === "LOST" || a.status === "LOSE"
                        ? "text-red-400"
                        : "text-white/40"}`}>
                    {a.status}
                  </span>
                </div>
              </li>))}
          </ul>) : (<div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 h-16 w-16 rounded-full bg-white/5 flex items-center justify-center text-white/10">
              <TrendingUp size={32}/>
            </div>
            <p className="text-white/30 font-medium tracking-wide">
              {t.common?.noData || "暂无最新动态，快去开启你的第一场预测吧！"}
            </p>
          </div>)}
      </div>

      <div className="mt-8 glass rounded-3xl p-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Indexed Portfolio Records</h2>
            <p className="mt-2 text-sm text-white/50">Positions, trades and claims are read from the Indexer Read API.</p>
          </div>
          {indexerAddress && (<span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/50">
              {indexerAddress.slice(0, 6)}...{indexerAddress.slice(-4)}
            </span>)}
        </div>

        {!activeWallet?.address && !user?.address && previewAddress && (<div className="mb-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            Read-only preview for indexed wallet address
          </div>)}

        {!indexerAddress ? (<div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/45">
            Connect wallet to view indexed positions, trades and claims
          </div>) : indexerUnavailable ? (<div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6 text-sm text-yellow-100">
            <p>Indexer data unavailable</p>
            <p className="mt-1 text-yellow-200/70">On-chain trading remains available</p>
          </div>) : indexerError ? (<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            {indexerError.message}
          </div>) : (<div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Indexed Positions</h3>
              {indexedPositionsLoading ? (<div className="mt-4 animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (<div key={i} className="h-20 rounded-xl bg-white/5"/>))}
                </div>) : indexedPositions && indexedPositions.length > 0 ? (<div className="mt-4 space-y-3">
                  {indexedPositions.map((position) => (<div key={`${position.marketAddress}-${position.userAddress}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
                      <p className="break-all font-semibold text-white">{position.marketAddress}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-4 text-xs">
                        <p>YES shares: <span className="text-white">{position.yesShares}</span></p>
                        <p>NO shares: <span className="text-white">{position.noShares}</span></p>
                        <p>claimed: <span className="text-white">{String(position.claimed)}</span></p>
                        <p>refunded: <span className="text-white">{String(position.refunded)}</span></p>
                      </div>
                    </div>))}
                </div>) : (<p className="mt-4 text-sm text-white/40">No indexed positions yet</p>)}
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Indexed Trades</h3>
              {indexedTradesLoading ? (<div className="mt-4 animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (<div key={i} className="h-24 rounded-xl bg-white/5"/>))}
                </div>) : indexedTrades && indexedTrades.length > 0 ? (<div className="mt-4 space-y-3">
                  {indexedTrades.map((trade) => (<div key={`${trade.txHash}-${trade.logIndex}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-white">{trade.side} / {trade.action}</p>
                        <p className="text-xs text-white/40">block #{trade.blockNumber}</p>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
                        <p className="break-all">marketAddress: <span className="text-white">{trade.marketAddress}</span></p>
                        <p>sharesAmount: <span className="text-white">{trade.sharesAmount}</span></p>
                        <p>collateralAmount: <span className="text-white">{trade.collateralAmount}</span></p>
                        <p>txHash: <span className="text-white">{formatHash(trade.txHash)}</span></p>
                      </div>
                    </div>))}
                </div>) : (<p className="mt-4 text-sm text-white/40">No indexed trades yet</p>)}
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Indexed Claims</h3>
              {indexedClaimsLoading ? (<div className="mt-4 animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (<div key={i} className="h-24 rounded-xl bg-white/5"/>))}
                </div>) : indexedClaims && indexedClaims.length > 0 ? (<div className="mt-4 space-y-3">
                  {indexedClaims.map((claim) => (<div key={`${claim.txHash}-${claim.logIndex}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/70">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-white">{claim.type}</p>
                        <p className="text-xs text-white/40">block #{claim.blockNumber}</p>
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2 text-xs">
                        <p className="break-all">marketAddress: <span className="text-white">{claim.marketAddress}</span></p>
                        <p>amount: <span className="text-white">{claim.amount}</span></p>
                        <p>txHash: <span className="text-white">{formatHash(claim.txHash)}</span></p>
                        <p>type: <span className="text-white">{claim.type}</span></p>
                      </div>
                    </div>))}
                </div>) : (<p className="mt-4 text-sm text-white/40">No indexed claims yet</p>)}
            </div>
          </div>)}
      </div>
    </div>);
}

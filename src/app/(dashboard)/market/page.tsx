"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMarkets } from "@/hooks/use-markets";
import { C10MarketHeader } from "@/components/market/c10-header";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { XMARKET_CONTRACTS } from "@/lib/contracts";
import { isIndexerUnavailableError } from "@/lib/indexer/client";
import {
    useIndexerHealth,
    useIndexerMarkets,
    useIndexerMarketTrades,
} from "@/lib/indexer/hooks";
const C10PriceChart = dynamic(() => import("@/components/market/c10-price-chart").then(mod => mod.C10PriceChart), {
    ssr: false,
    loading: () => (<div className="h-[400px] rounded-xl border border-white/5 bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"/>
          <span className="text-xs text-white/40">Loading Chart...</span>
        </div>
      </div>)
});
const AMMTradingPanel = dynamic(() => import("@/components/market/amm-trading-panel").then(mod => mod.AMMTradingPanel), { ssr: false });
const AMMPriceChart = dynamic(() => import("@/components/market/amm-price-chart").then(mod => mod.AMMPriceChart), { ssr: false });
import { AiAnalystPanel } from "@/components/market/ai-analyst-panel";
import { C10PredictionPanel } from "@/components/market/c10-prediction-panel";
import { C10Components } from "@/components/market/c10-components";
import { SimpleTradingPanel } from "@/components/market/simple-trading-panel";
import { MarketOdds } from "@/components/market/market-odds";
import { BacktestPanel } from "@/components/market/backtest-panel";
import { EsportsMatches } from "@/components/market/esports-matches";
import { EsportsHotMatches } from "@/components/market/esports-hot-matches";
import { FootballMatches } from "@/components/market/football-matches";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Icons } from "@/components/ui/icons";
import { useLanguageStore } from "@/stores/language-store";
import { OctopusLoader } from "@/components/ui/octopus-loader";
import { SparklesCore } from "@/components/aceternity/sparkles";
type MarketCategory = 'C10' | 'GOLD' | 'ESPORTS' | 'FOOTBALL';
export default function C10MarketPage() {
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<MarketCategory>('C10');
    const [currentPrice, setCurrentPrice] = useState(0);
    const [priceChange, setPriceChange] = useState(0);
    const [selectedEsportsMatchId, setSelectedEsportsMatchId] = useState<string | null>(null);
    const { markets, isLoading } = useMarkets();
    const smokeMarketAddress = XMARKET_CONTRACTS.smokeTestMarket.toLowerCase();
    const { user: authUser } = useAuth();
    const { profile: userProfile } = useProfile(authUser?.id || "");
    const { t } = useLanguageStore();
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
    const indexedMarket = indexerMarkets?.find((item) => item.marketAddress === smokeMarketAddress) || indexerMarkets?.[0];
    const {
        data: indexedTrades,
        isLoading: indexedTradesLoading,
        error: indexedTradesError,
    } = useIndexerMarketTrades(indexedMarket?.marketAddress);
    const indexerUnavailable = [
        indexerHealthError,
        indexerMarketsError,
        indexedTradesError,
    ].some(isIndexerUnavailableError);
    const indexerErrors = [
        indexerHealthError,
        indexerMarketsError,
        indexedTradesError,
    ].filter(Boolean);
    const latestIndexedTrade = indexedTrades?.[0];
    const { data: roundData } = useQuery({
        queryKey: ['currentRound', 'ESPORTS'],
        queryFn: () => api.getCurrentRound('ESPORTS'),
        refetchInterval: activeTab === 'ESPORTS' ? 5000 : false,
        staleTime: 3000,
        enabled: activeTab === 'ESPORTS',
    });
    const currentRound = roundData?.success ? roundData.round : null;
    useEffect(() => {
        setMounted(true);
    }, []);
    const activeMarket = markets?.find(m => m.category === activeTab && m.status === 'ACTIVE');
    if (!mounted) {
        return (<div className="relative flex h-[calc(100vh-4rem)] items-center justify-center bg-transparent">
        
        <div className="absolute inset-0">
          <SparklesCore background="transparent" minSize={0.3} maxSize={0.8} particleDensity={20} particleColor="#06b6d4"/>
        </div>
        <OctopusLoader size="lg" text={t.marketPage?.initTerminal || "Initialising Terminal..."}/>
      </div>);
    }
    if (isLoading) {
        return (<div className="relative flex h-[calc(100vh-4rem)] items-center justify-center bg-transparent">
        <div className="absolute inset-0">
          <SparklesCore background="transparent" minSize={0.3} maxSize={0.8} particleDensity={15} particleColor="#a855f7"/>
        </div>
        <OctopusLoader size="md" text={t.common?.loading || "Loading Markets..."}/>
      </div>);
    }
    const mp = t.marketPage || {};
    const categories = [
        {
            id: 'C10' as MarketCategory,
            name: mp.categories?.c10?.name || 'C10 Index',
            icon: (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 3v18h18" strokeLinecap="round"/>
          <path d="M6 15l4-4 4 2 6-7" strokeLinecap="round" className="text-cyan-400"/>
          
          <ellipse cx="20" cy="6" rx="2" ry="1.5" className="fill-cyan-400/30 stroke-cyan-400"/>
          <circle cx="19.5" cy="5.8" r="0.3" fill="currentColor"/>
          <circle cx="20.5" cy="5.8" r="0.3" fill="currentColor"/>
        </svg>),
            description: mp.categories?.c10?.desc || 'Crypto composite index',
            tentacles: 8
        },
        {
            id: 'GOLD' as MarketCategory,
            name: mp.categories?.gold?.name || 'Gold',
            icon: (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" className="fill-yellow-400/30 stroke-yellow-400"/>
          
          <path d="M4 14c-1 2-1 4 0 5" strokeLinecap="round" className="text-yellow-400/60"/>
          <path d="M20 14c1 2 1 4 0 5" strokeLinecap="round" className="text-yellow-400/60"/>
        </svg>),
            description: mp.categories?.gold?.desc || 'Precious metals market',
            tentacles: 4
        },
        {
            id: 'ESPORTS' as MarketCategory,
            name: mp.categories?.esports?.name || 'Live Esports',
            icon: (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="6" width="16" height="12" rx="2" className="stroke-purple-400"/>
          <path d="M8 12h2M14 12h2M11 10v4" strokeLinecap="round" className="text-purple-400"/>
          
          <circle cx="9" cy="4" r="1" className="fill-purple-400"/>
          <circle cx="15" cy="4" r="1" className="fill-purple-400"/>
          <path d="M9 4v2M15 4v2" strokeLinecap="round" className="text-purple-400/60"/>
        </svg>),
            description: mp.categories?.esports?.desc || 'Esports match predictions',
            tentacles: 6
        },
        {
            id: 'FOOTBALL' as MarketCategory,
            name: mp.categories?.football?.name || 'Football',
            icon: (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" className="stroke-green-400"/>
          <path d="M12 3c0 0 4 4 4 9s-4 9-4 9M12 3c0 0-4 4-4 9s4 9 4 9" strokeLinecap="round" className="stroke-green-400" opacity="0.5"/>
          <path d="M3 12h18" strokeLinecap="round" className="stroke-green-400" opacity="0.5"/>
          
          <ellipse cx="18" cy="18" rx="2" ry="1.5" className="fill-green-400/30 stroke-green-400"/>
          <circle cx="17.5" cy="17.8" r="0.3" fill="currentColor" className="fill-green-400"/>
          <circle cx="18.5" cy="17.8" r="0.3" fill="currentColor" className="fill-green-400"/>
        </svg>),
            description: mp.categories?.football?.desc || 'Global football leagues',
            tentacles: 7
        },
    ];
    return (<div className="flex flex-col min-h-screen max-w-[100vw] overflow-x-hidden">
      <div className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        
        <C10MarketHeader market={activeMarket} isLoading={isLoading}/>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0b0b0b] to-[#111111] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">
                Indexer Market Snapshot
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
                This page reads indexed market metadata and trade history from the Indexer API.
                Existing on-chain trading flows remain unchanged.
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-[10px] font-bold ${indexerUnavailable
                ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
                : "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"}`}>
              {indexerHealthLoading ? "Checking" : indexerUnavailable ? "Unavailable" : (indexerHealth?.status || "Ready")}
            </span>
          </div>

          {indexerUnavailable ? (
            <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              <p>Indexer data unavailable</p>
              <p className="mt-1 text-xs text-yellow-200/70">
                On-chain trading remains available
              </p>
            </div>
          ) : indexerErrors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {(indexerErrors[0] as Error).message}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Health</p>
                {indexerHealthLoading ? (
                  <p className="mt-2 text-xs text-white/45">Checking indexer health...</p>
                ) : indexerHealth ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-white">{indexerHealth.status}</p>
                    <p className="mt-1 text-xs text-white/55">chainId: {indexerHealth.chainId}</p>
                    <p className="mt-1 text-xs text-white/55">database: {indexerHealth.database}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-white/45">No health payload</p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexed Market</p>
                {indexerMarketsLoading ? (
                  <p className="mt-2 text-xs text-white/45">Loading indexed markets...</p>
                ) : indexedMarket ? (
                  <>
                    <p className="mt-2 break-all text-xs text-white/70">{indexedMarket.marketAddress}</p>
                    <p className="mt-2 text-xs text-white/55">status: <span className="text-white">{indexedMarket.status}</span></p>
                    <p className="mt-1 text-xs text-white/55">outcome: <span className="text-white">{indexedMarket.outcome}</span></p>
                    <p className="mt-1 text-xs text-white/55">marketId: <span className="text-white">{indexedMarket.marketId}</span></p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-white/45">No indexed markets yet</p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Trade Count</p>
                {indexedTradesLoading ? (
                  <p className="mt-2 text-xs text-white/45">Loading indexed trades...</p>
                ) : indexedTrades ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-white">{indexedTrades.length}</p>
                    <p className="mt-1 text-xs text-white/55">
                      latest block: <span className="text-white">{latestIndexedTrade?.blockNumber || "—"}</span>
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      latest indexed: <span className="text-white">{latestIndexedTrade?.blockTimestamp || "No timestamp"}</span>
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-white/45">No indexed trades yet</p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Data Availability</p>
                {indexedMarket ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {indexedTrades && indexedTrades.length > 0 ? "Trades Indexed" : "Metadata Only"}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      current tab: <span className="text-white">{activeTab}</span>
                    </p>
                    <Link
                      href={`/market/${indexedMarket.marketAddress}`}
                      className="mt-3 inline-flex rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
                    >
                      Open indexed detail
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-white/45">Indexer has not indexed a market yet</p>
                )}
              </div>
            </div>
          )}
        </div>

        
        <div className="grid grid-cols-2 md:flex md:items-center gap-2 sm:gap-3 select-none">
          {categories.map((cat) => (<button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`group relative flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl border transition-all ${activeTab === cat.id
                ? 'bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-cyan-500/30 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/[0.05] hover:text-white hover:border-white/10'}`}>
              
              <span className={`transition-transform duration-300 flex-shrink-0 ${activeTab === cat.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                {React.cloneElement(cat.icon as React.ReactElement<{ className?: string }>, { className: 'w-5 h-5 sm:w-6 sm:h-6' })}
              </span>
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm font-bold truncate">{cat.name}</div>
                <div className="text-[9px] sm:text-[10px] text-white/40 flex items-center gap-1">
                  <span className="truncate hidden xs:inline">{cat.description}</span>
                  
                  <span className="flex gap-0.5 ml-1 flex-shrink-0">
                    {Array.from({ length: 3 }).map((_, i) => (<span key={i} className={`w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full ${activeTab === cat.id ? 'bg-cyan-400' : 'bg-white/20'}`}/>))}
                  </span>
                </div>
              </div>
              
              {activeTab === cat.id && (<span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"/>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"/>
                </span>)}
            </button>))}
        </div>

        
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6">
          
          <div className="xl:col-span-8 space-y-4 sm:space-y-6">
            
            {activeTab === 'ESPORTS' ? (<>
                
                <EsportsMatches selectedMatchId={selectedEsportsMatchId} onMatchSelect={setSelectedEsportsMatchId}/>

                
                {currentRound?.id && (<AMMPriceChart roundId={currentRound.id}/>)}

                
                {currentRound?.id && (<AMMTradingPanel roundId={currentRound.id} category="ESPORTS"/>)}
              </>) : activeTab === 'FOOTBALL' ? (<>
                
                <FootballMatches />
              </>) : (<>
                
                <C10PriceChart activeTab={activeTab as 'C10' | 'GOLD'} onTabChange={(tab) => setActiveTab(tab)} onPriceUpdate={(price, change) => {
                setCurrentPrice(price);
                setPriceChange(change);
            }}/>

                
                <SimpleTradingPanel marketType={activeTab as 'C10' | 'GOLD'} currentPrice={currentPrice} priceChange={priceChange}/>

                
                <C10Components activeTab={activeTab as 'C10' | 'GOLD'}/>
              </>)}
          </div>

          
          <div className="xl:col-span-4 space-y-4 sm:space-y-6">
            
            {activeTab === 'ESPORTS' && currentRound?.id && (<MarketOdds roundId={currentRound.id}/>)}
            
            
            {activeTab === 'ESPORTS' && (<EsportsHotMatches onMatchClick={(matchId) => {
                console.log('🎯 从右侧边栏选择比赛:', matchId);
                setSelectedEsportsMatchId(matchId);
                setTimeout(() => {
                    const mainContent = document.querySelector('[data-esports-main]');
                    console.log('📍 查找主内容区域:', mainContent);
                    if (mainContent) {
                        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        console.log('✅ 已滚动到主内容区域');
                    }
                    else {
                        console.error('❌ 未找到主内容区域元素');
                    }
                }, 100);
            }}/>)}

            
            {activeTab === 'FOOTBALL' && (<div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                  </svg>
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">{mp.football?.hotLeagues || 'Hot Leagues'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                { name: mp.football?.premierLeague || 'Premier League', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', color: 'from-purple-500/10 to-blue-500/10' },
                { name: mp.football?.laLiga || 'La Liga', flag: '🇪🇸', color: 'from-red-500/10 to-yellow-500/10' },
                { name: mp.football?.bundesliga || 'Bundesliga', flag: '🇩🇪', color: 'from-red-500/10 to-black/10' },
                { name: mp.football?.serieA || 'Serie A', flag: '🇮🇹', color: 'from-green-500/10 to-white/5' },
                { name: mp.football?.ligue1 || 'Ligue 1', flag: '🇫🇷', color: 'from-blue-500/10 to-red-500/10' },
                { name: mp.football?.championsLeague || 'Champions League', flag: '⭐', color: 'from-blue-600/10 to-indigo-500/10' },
            ].map((league) => (<div key={league.name} className={`p-3 rounded-xl bg-gradient-to-br ${league.color} border border-white/5 text-center hover:border-white/10 transition-all cursor-pointer`}>
                      <span className="text-xl">{league.flag}</span>
                      <div className="text-xs font-medium text-white/80 mt-1">{league.name}</div>
                    </div>))}
                </div>
              </div>)}
            
            
            {(activeTab === 'C10' || activeTab === 'GOLD') && (<>
                <BacktestPanel market={activeMarket}/>
                <AiAnalystPanel market={activeMarket}/>
                <C10PredictionPanel market={activeMarket}/>
              </>)}
          </div>
        </div>
      </div>
    </div>);
}

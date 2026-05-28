"use client";
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LOLIcon, DOTA2Icon, CS2Icon, LiveIcon, AllGamesIcon, } from '@/components/ui/esports-icons';
interface EsportsTeam {
    id: string;
    name: string;
    shortName?: string;
}
interface EsportsMatch {
    id: string;
    game: 'LOL' | 'DOTA2' | 'CS2';
    league: string;
    tournament?: string;
    homeTeam: EsportsTeam;
    awayTeam: EsportsTeam;
    status: 'UPCOMING' | 'LIVE' | 'FINISHED';
    homeBetPool: number;
    awayBetPool: number;
    homeOdds?: number;
    awayOdds?: number;
    streamUrl?: string;
    scheduledAt?: string;
}
const GameIconComponents: Record<string, React.FC<{
    size?: number;
}>> = {
    LOL: LOLIcon,
    DOTA2: DOTA2Icon,
    CS2: CS2Icon,
};
interface EsportsHotMatchesProps {
    className?: string;
    onMatchClick?: (matchId: string) => void;
}
export function EsportsHotMatches({ className, onMatchClick }: EsportsHotMatchesProps) {
    const { data: hotMatchesData, isLoading } = useQuery({
        queryKey: ['hotEsportsMatches'],
        queryFn: () => api.getHotEsportsMatches(10),
        refetchInterval: 15000,
        staleTime: 5000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
    });
    const { data: statsData } = useQuery({
        queryKey: ['esportsStats'],
        queryFn: () => api.getEsportsStats(),
        refetchInterval: 60000,
        staleTime: 30000,
        refetchOnWindowFocus: true,
    });
    const hotMatches: EsportsMatch[] = hotMatchesData?.data || [];
    const stats = statsData?.data;
    const liveMatches = hotMatches.filter(m => m.status === 'LIVE' && m.streamUrl);
    const liveNoStreamMatches = hotMatches.filter(m => m.status === 'LIVE' && !m.streamUrl);
    const upcomingMatches = hotMatches.filter(m => m.status === 'UPCOMING');
    const sortedMatches = [...liveMatches, ...liveNoStreamMatches, ...upcomingMatches];
    const liveCount = liveMatches.length;
    const liveNoStreamCount = liveNoStreamMatches.length;
    return (<div className={cn("rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] p-5 space-y-4", className)}>
      
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </svg>
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">热门赛事</span>
      </div>

      
      {stats && (<div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/10 text-center">
            <div className="flex justify-center mb-1">
              <LOLIcon size={16}/>
            </div>
            <div className="text-xs font-bold text-blue-400">{stats.lol?.total || 0}</div>
            <div className="text-[10px] text-white/40">场比赛</div>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/10 text-center">
            <div className="flex justify-center mb-1">
              <DOTA2Icon size={16}/>
            </div>
            <div className="text-xs font-bold text-orange-400">{stats.dota2?.total || 0}</div>
            <div className="text-[10px] text-white/40">场比赛</div>
          </div>
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/10 text-center">
            <div className="flex justify-center mb-1">
              <CS2Icon size={16}/>
            </div>
            <div className="text-xs font-bold text-yellow-400">{stats.cs2?.total || 0}</div>
            <div className="text-[10px] text-white/40">场比赛</div>
          </div>
        </div>)}

      
      {isLoading && (<div className="flex items-center justify-center py-6">
          <div className="relative">
            <div className="w-8 h-8 border-2 border-purple-500/20 rounded-full"/>
            <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-t-purple-500 rounded-full animate-spin"/>
          </div>
        </div>)}

      
      {!isLoading && liveMatches.length > 0 && (<div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <LiveIcon size={14} animate/>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">正在直播</span>
            <span className="text-[10px] text-white/40">({liveMatches.length})</span>
          </div>
          {liveMatches.map((match) => {
                const totalPool = match.homeBetPool + match.awayBetPool;
                const volume = totalPool > 1000 ? `${(totalPool / 1000).toFixed(1)}K` : totalPool.toFixed(0);
                const GameIcon = GameIconComponents[match.game] || AllGamesIcon;
                return (<div key={match.id} onClick={() => {
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                        else {
                            const mainContent = document.querySelector('[data-esports-main]');
                            if (mainContent) {
                                mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }
                    }} className="p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/5 border-2 border-red-500/30 hover:border-red-500/50 transition-all cursor-pointer group relative overflow-hidden active:scale-[0.98]">
                
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-red-500/5 animate-pulse"/>
                
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/10 border border-red-500/30 flex items-center justify-center group-hover:border-red-500/50 transition-all">
                      <GameIcon size={16}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-bold text-white group-hover:text-red-300 transition-colors">
                          {match.homeTeam.shortName || match.homeTeam.name} vs {match.awayTeam.shortName || match.awayTeam.name}
                        </div>
                        <LiveIcon size={10} animate/>
                      </div>
                      <div className="text-[10px] text-white/50">{match.league}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <LiveIcon size={12} animate/>
                      <span className="text-[10px] text-red-400 font-bold uppercase animate-pulse">Live</span>
                    </div>
                    <div className="text-[10px] text-green-400 font-mono font-medium">{volume} PTS</div>
                  </div>
                </div>
                
                
                <div className="flex gap-2 mt-2.5 relative">
                  <button onClick={(e) => {
                        e.stopPropagation();
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                    }} className="flex-1 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-center hover:bg-green-500/30 hover:border-green-500/50 transition-all">
                    <span className="text-[10px] font-mono font-bold text-green-400">
                      {match.homeOdds?.toFixed(2) || '1.85'}
                    </span>
                  </button>
                  <button onClick={(e) => {
                        e.stopPropagation();
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                    }} className="flex-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/30 text-center hover:bg-red-500/30 hover:border-red-500/50 transition-all">
                    <span className="text-[10px] font-mono font-bold text-red-400">
                      {match.awayOdds?.toFixed(2) || '2.10'}
                    </span>
                  </button>
                </div>
                
                
                <div className="mt-2 flex gap-2 relative z-10">
                  <button onClick={(e) => {
                        e.stopPropagation();
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                        requestAnimationFrame(() => {
                            const mainContent = document.querySelector('[data-esports-main]');
                            if (mainContent) {
                                mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        });
                    }} className="flex-1 px-2 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50 transition-all text-center active:scale-95">
                    <span className="text-[10px] font-bold text-red-400 uppercase flex items-center justify-center gap-1">
                      <LiveIcon size={10} animate/>
                      观看直播
                    </span>
                  </button>
                  <button onClick={(e) => {
                        e.stopPropagation();
                        console.log('💰 点击预测:', match.id);
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                        setTimeout(() => {
                            const mainContent = document.querySelector('[data-esports-main]');
                            if (mainContent) {
                                mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }, 200);
                    }} className="flex-1 px-2 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 hover:bg-purple-500/30 hover:border-purple-500/50 transition-all text-center active:scale-95">
                    <span className="text-[10px] font-bold text-purple-400 uppercase">预测</span>
                  </button>
                </div>
              </div>);
            })}
        </div>)}

      
      {!isLoading && liveNoStreamMatches.length > 0 && (<div className="space-y-2">
          <div className="flex items-center gap-2 mb-2 mt-4 pt-4 border-t border-white/10">
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">进行中</span>
            <span className="text-[10px] text-white/30">无直播源 ({liveNoStreamMatches.length})</span>
          </div>
          {liveNoStreamMatches.map((match) => {
                const totalPool = match.homeBetPool + match.awayBetPool;
                const volume = totalPool > 1000 ? `${(totalPool / 1000).toFixed(1)}K` : totalPool.toFixed(0);
                const GameIcon = GameIconComponents[match.game] || AllGamesIcon;
                return (<div key={match.id} onClick={() => {
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                        setTimeout(() => {
                            const mainContent = document.querySelector('[data-esports-main]');
                            if (mainContent) {
                                mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }, 200);
                    }} className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-all cursor-pointer group active:scale-[0.98]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/20 flex items-center justify-center group-hover:border-orange-500/40 transition-all">
                      <GameIcon size={16}/>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{match.homeTeam.shortName} vs {match.awayTeam.shortName}</div>
                      <div className="text-[10px] text-white/40">{match.tournament || match.league}</div>
                    </div>
                  </div>
                  <span className="text-[10px] text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">无直播源</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-white/50">
                  <span>资金池</span>
                  <span className="font-mono">{volume}</span>
                </div>
              </div>);
            })}
        </div>)}

      
      {!isLoading && upcomingMatches.length > 0 && (<div className="space-y-2">
          {(liveMatches.length > 0 || liveNoStreamMatches.length > 0) && (<div className="flex items-center gap-2 mb-2 mt-4 pt-4 border-t border-white/10">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">即将开始</span>
              <span className="text-[10px] text-white/30">({upcomingMatches.length})</span>
            </div>)}
          {upcomingMatches.map((match) => {
                const totalPool = match.homeBetPool + match.awayBetPool;
                const volume = totalPool > 1000 ? `${(totalPool / 1000).toFixed(1)}K` : totalPool.toFixed(0);
                const GameIcon = GameIconComponents[match.game] || AllGamesIcon;
                return (<div key={match.id} onClick={() => {
                        console.log('🎯 点击即将开始的比赛:', match.id);
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                        setTimeout(() => {
                            const mainContent = document.querySelector('[data-esports-main]');
                            if (mainContent) {
                                mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                        }, 200);
                    }} className="p-3 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 hover:border-white/10 transition-all cursor-pointer group active:scale-[0.98]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/5 flex items-center justify-center group-hover:border-purple-500/20 transition-all">
                      <GameIcon size={16}/>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                        {match.homeTeam.shortName || match.homeTeam.name} vs {match.awayTeam.shortName || match.awayTeam.name}
                      </div>
                      <div className="text-[10px] text-white/40">{match.league}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-green-400 font-mono font-medium">{volume} PTS</div>
                  </div>
                </div>
                
                
                <div className="flex gap-2 mt-2.5">
                  <button onClick={(e) => {
                        e.stopPropagation();
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                    }} className="flex-1 px-2 py-1 rounded-lg bg-green-500/10 border border-green-500/10 text-center hover:bg-green-500/20 hover:border-green-500/30 transition-all">
                    <span className="text-[10px] font-mono font-bold text-green-400">
                      {match.homeOdds?.toFixed(2) || '1.85'}
                    </span>
                  </button>
                  <button onClick={(e) => {
                        e.stopPropagation();
                        if (onMatchClick) {
                            onMatchClick(match.id);
                        }
                    }} className="flex-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/10 text-center hover:bg-red-500/20 hover:border-red-500/30 transition-all">
                    <span className="text-[10px] font-mono font-bold text-red-400">
                      {match.awayOdds?.toFixed(2) || '2.10'}
                    </span>
                  </button>
                </div>
              </div>);
            })}
        </div>)}

      
      {!isLoading && sortedMatches.length === 0 && (<div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <AllGamesIcon size={24}/>
          </div>
          <div className="text-xs text-white/50 font-medium">暂无热门比赛</div>
          <div className="text-[10px] text-white/30 mt-0.5">稍后再来查看</div>
        </div>)}

      
      {(liveCount > 0 || liveNoStreamCount > 0) && (<div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
            <LiveIcon size={14} animate/>
            <span className="text-xs text-red-400 font-medium">
              {liveCount} 场可观看直播
              {liveNoStreamCount > 0 ? `，${liveNoStreamCount} 场无直播源` : ''}
            </span>
          </div>
        </div>)}
    </div>);
}

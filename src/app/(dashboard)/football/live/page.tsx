'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LiveMatchCard } from '@/components/football/live-match-card';
import { MatchEvents } from '@/components/football/match-events';
import { LiveOddsDisplay } from '@/components/football/live-odds-display';
import { BettingStats } from '@/components/football/betting-stats';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api';
import { useFootballLive, MatchLiveUpdate, FootballEvent, OddsUpdate, BettingPoolStats, } from '@/hooks/useFootballLive';
export default function FootballLivePage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [liveMatches, setLiveMatches] = useState<Map<string, MatchLiveUpdate>>(new Map());
    const [events, setEvents] = useState<Map<string, FootballEvent[]>>(new Map());
    const [odds, setOdds] = useState<Map<string, OddsUpdate>>(new Map());
    const [bettingStats, setBettingStats] = useState<Map<string, BettingPoolStats>>(new Map());
    const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedPrediction, setSelectedPrediction] = useState<'HOME' | 'DRAW' | 'AWAY' | null>(null);
    const [betAmount, setBetAmount] = useState<number>(100);
    const { data: profile } = useQuery({
        queryKey: ['userProfile', user?.id],
        queryFn: () => user?.id ? api.getUserProfile(user.id) : Promise.resolve(null),
        enabled: !!user?.id,
    });
    const userBalance = profile?.pts || 0;
    const betMutation = useMutation({
        mutationFn: (data: {
            matchId: string;
            prediction: 'HOME' | 'DRAW' | 'AWAY';
            amount: number;
        }) => api.placeFootballBet({
            userId: user?.id || '',
            matchId: data.matchId,
            prediction: data.prediction,
            amount: data.amount,
        }),
        onSuccess: () => {
            toast.success('下注成功！');
            setBetAmount(100);
            setSelectedPrediction(null);
            queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
        },
        onError: (error: Error) => {
            toast.error(error.message || '下注失败');
        },
    });
    const { socket, subscribeToMatch } = useFootballLive({
        onMatchUpdate: useCallback((update: MatchLiveUpdate) => {
            setLiveMatches((prev) => new Map(prev).set(update.matchId, update));
            if (!selectedMatch && update.status === 'LIVE') {
                setSelectedMatch(update.matchId);
            }
        }, [selectedMatch]),
        onEvent: useCallback((event: FootballEvent) => {
            setEvents((prev) => {
                const newEvents = new Map(prev);
                const matchEvents = newEvents.get(event.matchId) || [];
                newEvents.set(event.matchId, [...matchEvents, event]);
                return newEvents;
            });
        }, []),
        onOddsUpdate: useCallback((oddsUpdate: OddsUpdate) => {
            setOdds((prev) => new Map(prev).set(oddsUpdate.matchId, oddsUpdate));
        }, []),
        onBettingStats: useCallback((stats: BettingPoolStats) => {
            setBettingStats((prev) => new Map(prev).set(stats.matchId, stats));
        }, []),
        onConnect: useCallback(() => {
            setIsConnected(true);
            console.log('✅ Connected to Football Live');
        }, []),
        onDisconnect: useCallback(() => {
            setIsConnected(false);
            console.log('❌ Disconnected from Football Live');
        }, []),
        onError: useCallback((error: string) => {
            console.error('❌ Football Live Error:', error);
        }, []),
    });
    const getActiveMatches = useCallback(() => {
        return Array.from(liveMatches.values()).sort((a, b) => {
            const statusOrder = { LIVE: 0, HALFTIME: 1, UPCOMING: 2, FINISHED: 3 };
            const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 999;
            const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 999;
            if (aOrder !== bOrder)
                return aOrder - bOrder;
            return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
        });
    }, [liveMatches]);
    const activeMatches = getActiveMatches();
    const currentMatch = selectedMatch ? liveMatches.get(selectedMatch) : activeMatches[0];
    const currentEvents = selectedMatch ? events.get(selectedMatch) || [] : [];
    const currentOdds = selectedMatch ? odds.get(selectedMatch) || null : null;
    const currentStats = selectedMatch ? bettingStats.get(selectedMatch) || null : null;
    const handleBet = useCallback(() => {
        if (!user?.id) {
            toast.error('请先登录');
            return;
        }
        if (!currentMatch) {
            toast.error('请选择比赛');
            return;
        }
        if (!selectedPrediction) {
            toast.error('请选择预测');
            return;
        }
        if (betAmount <= 0) {
            toast.error('下注金额必须大于0');
            return;
        }
        if (betAmount > userBalance) {
            toast.error('积分不足');
            return;
        }
        betMutation.mutate({
            matchId: currentMatch.matchId,
            prediction: selectedPrediction,
            amount: betAmount,
        });
    }, [user?.id, currentMatch, selectedPrediction, betAmount, userBalance, betMutation]);
    return (<div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      
      <div className="sticky top-0 z-10 border-b border-gray-800 bg-black/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-2xl font-bold">
            ⚽ Football Live <span className="text-lg">Broadcasting</span>
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-white/40">余额</p>
              <p className="text-lg font-bold text-yellow-400">{userBalance.toLocaleString()} PTS</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/>
              <span className="text-sm text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          <div className="space-y-4 lg:col-span-1">
            <h2 className="text-lg font-bold">📋 All Matches ({activeMatches.length})</h2>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {activeMatches.length === 0 ? (<div className="rounded-lg border border-gray-500/30 bg-gray-500/5 p-6 text-center">
                  <p className="text-sm text-gray-500">No live matches at the moment</p>
                </div>) : (activeMatches.map((match) => (<button key={match.matchId} onClick={() => setSelectedMatch(match.matchId)} className={`w-full transition-opacity duration-200 ${selectedMatch === match.matchId ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`} aria-label={`Select match ${match.matchId}`}>
                    <LiveMatchCard match={match}/>
                  </button>)))}
            </div>
          </div>

          
          {currentMatch ? (<div className="space-y-6 lg:col-span-2">
              
              <div>
                <h2 className="mb-3 text-lg font-bold">🎯 Match Details</h2>
                <LiveMatchCard match={currentMatch}/>
              </div>

              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h2 className="mb-3 text-lg font-bold">💰 Odds</h2>
                  <LiveOddsDisplay odds={currentOdds} matchId={currentMatch.matchId} onSelect={setSelectedPrediction}/>
                </div>
                <div>
                  <h2 className="mb-3 text-lg font-bold">📊 Betting Pool</h2>
                  <BettingStats stats={currentStats}/>
                </div>
              </div>

              
              <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/2 p-6 space-y-4">
                <h2 className="text-lg font-bold">🎲 Place Bet</h2>
                
                
                {selectedPrediction && (<div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                    <span className="text-sm text-white/60">预测:</span>
                    <span className={`font-bold ${selectedPrediction === 'HOME' ? 'text-green-400' :
                    selectedPrediction === 'DRAW' ? 'text-yellow-400' :
                        'text-red-400'}`}>
                      {selectedPrediction === 'HOME' ? '主胜 🏠' :
                    selectedPrediction === 'DRAW' ? '平局 🤝' :
                        '客胜 ✈️'}
                    </span>
                  </div>)}

                
                <div className="space-y-2">
                  <label className="text-sm text-white/60">下注金额 (PTS)</label>
                  <div className="flex gap-2">
                    <input type="number" value={betAmount} onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))} className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50" placeholder="输入下注金额"/>
                    <button onClick={() => setBetAmount(Math.floor(userBalance / 2))} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white/60 transition-colors">
                      1/2
                    </button>
                    <button onClick={() => setBetAmount(userBalance)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white/60 transition-colors">
                      All
                    </button>
                  </div>
                </div>

                
                {selectedPrediction && currentOdds && (<div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-white/40">赔率</p>
                      <p className="font-bold text-cyan-400">
                        {selectedPrediction === 'HOME' ? currentOdds.homeOdds :
                    selectedPrediction === 'DRAW' ? currentOdds.drawOdds :
                        currentOdds.awayOdds}x
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-white/40">潜在收益</p>
                      <p className="font-bold text-green-400">
                        {(betAmount * (selectedPrediction === 'HOME' ? currentOdds.homeOdds :
                    selectedPrediction === 'DRAW' ? currentOdds.drawOdds :
                        currentOdds.awayOdds)).toLocaleString()} PTS
                      </p>
                    </div>
                  </div>)}

                
                <button onClick={handleBet} disabled={!selectedPrediction || betAmount <= 0 || betAmount > userBalance || betMutation.isPending} className="w-full py-3 rounded-lg font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25">
                  {betMutation.isPending ? '处理中...' : '确认下注'}
                </button>
              </div>

              
              <div>
                <h2 className="mb-3 text-lg font-bold">📝 Match Events ({currentEvents.length})</h2>
                <MatchEvents events={currentEvents} matchId={currentMatch.matchId}/>
              </div>
            </div>) : (<div className="flex items-center justify-center rounded-lg border border-gray-500/30 bg-gray-500/5 p-12 lg:col-span-2">
              <p className="text-lg text-gray-500">Select a match to view details</p>
            </div>)}
        </div>
      </div>

      
      <div className="border-t border-gray-800 bg-black/80 backdrop-blur-md px-4 py-4">
        <div className="mx-auto max-w-7xl text-center text-xs text-gray-500">
          <p>🔄 Updates in real-time • 📱 Mobile friendly • 🔐 Secure betting</p>
        </div>
      </div>
    </div>);
}

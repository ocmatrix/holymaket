"use client";
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { FootballIcon, TeamLogo, LeagueBadge, LiveIndicator, ScoreDisplay, } from '@/components/ui/football-icons';
interface FootballTeam {
    id: number;
    name: string;
    logo: string;
}
interface FootballMatch {
    id: string;
    fixtureId: number;
    league: string;
    leagueLogo: string;
    leagueCountry: string;
    round: string;
    homeTeam: FootballTeam;
    awayTeam: FootballTeam;
    scheduledAt: string;
    status: 'UPCOMING' | 'LIVE' | 'HALFTIME' | 'FINISHED' | 'POSTPONED' | 'CANCELLED';
    elapsed: number | null;
    homeScore: number;
    awayScore: number;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    venue: string | null;
    tvChannels?: {
        name: string;
    }[];
}
function Countdown({ targetDate, className }: {
    targetDate: string;
    className?: string;
}) {
    const [timeDisplay, setTimeDisplay] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isExpired: boolean;
    }>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
    });
    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const diff = target - now;
            const isExpired = diff <= 0;
            const absDiff = Math.abs(diff);
            const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
            setTimeDisplay({ days, hours, minutes, seconds, isExpired });
        };
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [targetDate]);
    const { days, hours, minutes, seconds, isExpired } = timeDisplay;
    const formatNumber = (n: number) => n.toString().padStart(2, '0');
    return (<div className={cn("flex items-center gap-1", className)}>
      {isExpired && (<span className="text-orange-400 text-[10px] mr-1">超时</span>)}
      {days > 0 ? (<span className="font-mono tabular-nums text-xs">
          {days}天 {hours}时
        </span>) : (<div className="flex items-center gap-0.5 font-mono tabular-nums text-xs">
          {hours > 0 && (<>
              <span className="bg-white/10 px-1 py-0.5 rounded">{formatNumber(hours)}</span>
              <span className="text-white/40">:</span>
            </>)}
          <span className="bg-white/10 px-1 py-0.5 rounded">{formatNumber(minutes)}</span>
          <span className="text-white/40">:</span>
          <span className={cn("px-1 py-0.5 rounded", isExpired ? "bg-orange-500/20 text-orange-400" : "bg-white/10")}>
            {formatNumber(seconds)}
          </span>
        </div>)}
    </div>);
}
interface MatchCardProps {
    match: FootballMatch;
    onBet: (matchId: string, prediction: 'HOME' | 'DRAW' | 'AWAY', amount: number) => void;
    isBetting: boolean;
    userBalance: number;
}
function MatchCard({ match, onBet, isBetting, userBalance }: MatchCardProps) {
    const [selectedSide, setSelectedSide] = useState<'HOME' | 'DRAW' | 'AWAY' | null>(null);
    const [betAmount, setBetAmount] = useState(100);
    const isLive = match.status === 'LIVE' || match.status === 'HALFTIME';
    const isUpcoming = match.status === 'UPCOMING';
    const isFinished = match.status === 'FINISHED';
    const canBet = isLive || isUpcoming;
    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };
    return (<div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:from-white/10 hover:to-white/5 transition-all">
      
      <div className="flex items-center justify-between mb-4">
        <LeagueBadge name={match.league} logo={match.leagueLogo} country={match.leagueCountry}/>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {isLive ? (<div className="flex items-center gap-2">
                <LiveIndicator />
                {match.elapsed && (<span className="text-xs font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                    {match.elapsed}'
                  </span>)}
              </div>) : isUpcoming ? (<div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 4V8L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <Countdown targetDate={match.scheduledAt} className="text-yellow-400"/>
              </div>) : isFinished ? (<span className="text-xs text-white/40 bg-white/5 px-2 py-1 rounded">已结束</span>) : (<span className="text-xs text-white/40">{formatTime(match.scheduledAt)}</span>)}
          </div>
          {match.tvChannels && match.tvChannels.length > 0 && (<div className="text-[10px] text-white/50">
              直播频道：
              {match.tvChannels.map((channel, idx) => (<span key={`${channel.name}-${idx}`} className="font-mono">
                  {idx > 0 ? ' / ' : ''}
                  {channel.name}
                </span>))}
            </div>)}
        </div>
      </div>

      
      <div className="flex items-center justify-between mb-4">
        
        <div className={cn("flex-1 flex flex-col items-center cursor-pointer transition-all", selectedSide === 'HOME' && "scale-105", canBet && "hover:scale-105")} onClick={() => canBet && setSelectedSide(selectedSide === 'HOME' ? null : 'HOME')}>
          <TeamLogo src={match.homeTeam.logo} name={match.homeTeam.name} size={56} className={cn("mb-2 transition-all", selectedSide === 'HOME' && "ring-2 ring-green-500 ring-offset-2 ring-offset-black")}/>
          <span className={cn("text-sm font-bold text-center transition-colors", selectedSide === 'HOME' ? "text-green-400" : "text-white/90")}>
            {match.homeTeam.name}
          </span>
        </div>

        
        <div className="flex-shrink-0 px-4">
          {isLive || isFinished ? (<ScoreDisplay home={match.homeScore} away={match.awayScore} elapsed={isLive ? match.elapsed : null}/>) : (<div className="text-center">
              <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                VS
              </div>
              <div className="text-[10px] text-white/40 mt-1">{match.round}</div>
            </div>)}
        </div>

        
        <div className={cn("flex-1 flex flex-col items-center cursor-pointer transition-all", selectedSide === 'AWAY' && "scale-105", canBet && "hover:scale-105")} onClick={() => canBet && setSelectedSide(selectedSide === 'AWAY' ? null : 'AWAY')}>
          <TeamLogo src={match.awayTeam.logo} name={match.awayTeam.name} size={56} className={cn("mb-2 transition-all", selectedSide === 'AWAY' && "ring-2 ring-red-500 ring-offset-2 ring-offset-black")}/>
          <span className={cn("text-sm font-bold text-center transition-colors", selectedSide === 'AWAY' ? "text-red-400" : "text-white/90")}>
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      
      <div className="grid grid-cols-3 gap-2 mb-4">
        
        <button onClick={() => canBet && setSelectedSide(selectedSide === 'HOME' ? null : 'HOME')} disabled={!canBet} className={cn("flex flex-col items-center py-2 px-3 rounded-lg transition-all", selectedSide === 'HOME'
            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25"
            : "bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20", !canBet && "opacity-50 cursor-not-allowed")}>
          <span className="text-[10px] text-white/60 mb-0.5">主胜</span>
          <span className="text-lg font-mono font-bold">{match.homeOdds.toFixed(2)}</span>
        </button>

        
        <button onClick={() => canBet && setSelectedSide(selectedSide === 'DRAW' ? null : 'DRAW')} disabled={!canBet} className={cn("flex flex-col items-center py-2 px-3 rounded-lg transition-all", selectedSide === 'DRAW'
            ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg shadow-yellow-500/25"
            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20", !canBet && "opacity-50 cursor-not-allowed")}>
          <span className="text-[10px] text-white/60 mb-0.5">平局</span>
          <span className="text-lg font-mono font-bold">{match.drawOdds.toFixed(2)}</span>
        </button>

        
        <button onClick={() => canBet && setSelectedSide(selectedSide === 'AWAY' ? null : 'AWAY')} disabled={!canBet} className={cn("flex flex-col items-center py-2 px-3 rounded-lg transition-all", selectedSide === 'AWAY'
            ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/25"
            : "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20", !canBet && "opacity-50 cursor-not-allowed")}>
          <span className="text-[10px] text-white/60 mb-0.5">客胜</span>
          <span className="text-lg font-mono font-bold">{match.awayOdds.toFixed(2)}</span>
        </button>
      </div>

      
      {selectedSide && canBet && (<div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold", selectedSide === 'HOME' && "bg-green-500/20 text-green-400", selectedSide === 'DRAW' && "bg-yellow-500/20 text-yellow-400", selectedSide === 'AWAY' && "bg-red-500/20 text-red-400")}>
                {selectedSide === 'HOME' ? '主' : selectedSide === 'DRAW' ? '平' : '客'}
              </div>
              <div className="text-sm">
                <span className="text-white/60">预测 </span>
                <span className={cn("font-bold", selectedSide === 'HOME' && "text-green-400", selectedSide === 'DRAW' && "text-yellow-400", selectedSide === 'AWAY' && "text-red-400")}>
                  {selectedSide === 'HOME' ? `${match.homeTeam.name} 胜` :
                selectedSide === 'DRAW' ? '平局' :
                    `${match.awayTeam.name} 胜`}
                </span>
                <span className="text-white/40 ml-2">
                  @ <span className="font-mono text-white/60">
                    {selectedSide === 'HOME' ? match.homeOdds.toFixed(2) :
                selectedSide === 'DRAW' ? match.drawOdds.toFixed(2) :
                    match.awayOdds.toFixed(2)}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2 mr-2">
                <span className="text-[10px] text-white/40">金额</span>
                <input type="number" value={betAmount} onChange={(e) => setBetAmount(Math.max(10, Math.min(Number(e.target.value), userBalance)))} className="w-16 bg-transparent border-none text-xs font-mono font-bold text-yellow-400 focus:ring-0 p-0"/>
              </div>
              <button onClick={() => setSelectedSide(null)} className="px-4 py-2 rounded-lg text-xs font-bold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white transition-all">
                取消
              </button>
              <button onClick={() => {
                onBet(match.id, selectedSide, betAmount);
                setSelectedSide(null);
            }} disabled={isBetting || betAmount > userBalance} className="px-5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 transition-all shadow-lg shadow-green-500/25">
                {isBetting ? '下注中...' : '确认下注'}
              </button>
            </div>
          </div>
        </div>)}

      
      {match.venue && (<div className="mt-3 pt-3 border-t border-white/5 text-center">
          <span className="text-[10px] text-white/30">
            📍 {match.venue}
          </span>
        </div>)}
    </div>);
}
const LEAGUES = [
    { id: 0, name: '全部', icon: '⚽' },
    { id: 39, name: '英超', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 140, name: '西甲', icon: '🇪🇸' },
    { id: 78, name: '德甲', icon: '🇩🇪' },
    { id: 135, name: '意甲', icon: '🇮🇹' },
    { id: 61, name: '法甲', icon: '🇫🇷' },
    { id: 2, name: '欧冠', icon: '⭐' },
    { id: 169, name: '中超', icon: '🇨🇳' },
];
interface FootballMatchesProps {
    className?: string;
}
export function FootballMatches({ className }: FootballMatchesProps) {
    const [activeLeague, setActiveLeague] = useState<number>(0);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { data: matchesData, isLoading, error } = useQuery({
        queryKey: ['footballMatches', activeLeague],
        queryFn: () => api.getFootballMatches({
            league: activeLeague === 0 ? undefined : activeLeague,
            limit: 20,
        }),
        refetchInterval: 60000,
        staleTime: 30000,
    });
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
            queryClient.invalidateQueries({ queryKey: ['footballMatches'] });
            queryClient.invalidateQueries({ queryKey: ['userProfile', user?.id] });
        },
        onError: (error: Error) => {
            toast.error(error.message || '下注失败');
        },
    });
    const matches: FootballMatch[] = matchesData?.data || [];
    const { profile } = useProfile(user?.id || "");
    const userBalance = profile?.pts || 0;
    const handleBet = (matchId: string, prediction: 'HOME' | 'DRAW' | 'AWAY', amount: number) => {
        if (!user?.id) {
            toast.error('请先登录');
            return;
        }
        betMutation.mutate({ matchId, prediction, amount });
    };
    return (<div className={cn("rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] p-6 space-y-6", className)}>
      
      <div className="flex items-center justify-between">
        <div className="relative">
          <div className="absolute -left-4 top-0 h-full w-1 bg-gradient-to-b from-green-400 via-emerald-500 to-transparent rounded-full opacity-60"/>
          
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
              <FootballIcon size={22}/>
            </div>
            <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              足球预测
            </span>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30 uppercase tracking-wider">
              三向投注
            </span>
          </h2>
          <p className="text-sm text-white/40 mt-2">全球热门足球联赛，当前可用余额: <span className="text-yellow-400 font-mono font-bold">{userBalance.toLocaleString()} PTS</span></p>
        </div>
        <LiveIndicator />
      </div>

      
      <div className="flex gap-2 overflow-x-auto pb-2">
        {LEAGUES.map((league) => (<button key={league.id} onClick={() => setActiveLeague(league.id)} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all", activeLeague === league.id
                ? "bg-gradient-to-r from-green-500/30 to-emerald-500/30 text-white border border-green-500/30"
                : "bg-white/5 text-white/50 hover:text-white hover:bg-white/10")}>
            <span>{league.icon}</span>
            {league.name}
          </button>))}
      </div>

      
      {isLoading && (<div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 border-2 border-green-500/20 rounded-full"/>
              <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-green-500 rounded-full animate-spin"/>
            </div>
            <span className="text-xs text-white/50 font-medium">加载比赛数据...</span>
          </div>
        </div>)}

      
      {error && (<div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
          </div>
          <div className="text-sm text-white/60 font-medium">加载失败</div>
          <div className="text-xs text-white/40 mt-1">请稍后重试</div>
        </div>)}

      
      {!isLoading && !error && (<div className="space-y-4">
          {matches.length === 0 ? (<div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <FootballIcon size={32}/>
              </div>
              <div className="text-sm text-white/60 font-medium">暂无比赛</div>
              <div className="text-xs text-white/40 mt-1">稍后再来查看</div>
            </div>) : (matches.map((match) => (<MatchCard key={match.id} match={match} onBet={handleBet} isBetting={betMutation.isPending} userBalance={userBalance}/>)))}
        </div>)}

      
      <div className="rounded-xl border border-white/5 bg-gradient-to-br from-green-500/5 to-emerald-500/5 p-5 text-center">
        <div className="flex justify-center gap-4 mb-3 text-2xl">
          <span>🏴󠁧󠁢󠁥󠁮󠁧󠁿</span>
          <span>🇪🇸</span>
          <span>🇩🇪</span>
          <span>🇮🇹</span>
          <span>🇫🇷</span>
          <span>⭐</span>
        </div>
        <div className="text-sm text-white/60 font-medium">覆盖全球热门足球联赛</div>
        <div className="text-xs text-white/40 mt-1">英超、西甲、德甲、意甲、法甲、欧冠、中超</div>
      </div>
    </div>);
}

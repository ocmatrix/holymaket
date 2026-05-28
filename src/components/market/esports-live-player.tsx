"use client";
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { TwitchIcon, YouTubeIcon, BilibiliIcon, LiveIcon, UpcomingIcon, LOLIcon, DOTA2Icon, CS2Icon, } from '@/components/ui/esports-icons';
const STREAM_PLATFORMS: Record<string, {
    name: string;
    Icon: React.FC<{
        className?: string;
        size?: number;
    }>;
    color: string;
}> = {
    'twitch.tv': { name: 'Twitch', Icon: TwitchIcon, color: 'text-purple-400' },
    'youtube.com': { name: 'YouTube', Icon: YouTubeIcon, color: 'text-red-400' },
    'bilibili.com': { name: 'Bilibili', Icon: BilibiliIcon, color: 'text-pink-400' },
    'huya.com': { name: '虎牙', Icon: () => <span className="text-sm">虎</span>, color: 'text-orange-400' },
    'douyu.com': { name: '斗鱼', Icon: () => <span className="text-sm">鱼</span>, color: 'text-orange-400' },
};
const GameIcons: Record<string, React.FC<{
    size?: number;
}>> = {
    LOL: LOLIcon,
    DOTA2: DOTA2Icon,
    CS2: CS2Icon,
};
const FALLBACK_VIDEOS: Record<string, {
    id: string;
    title: string;
    description: string;
}[]> = {
    LOL: [
        { id: 'ihBJc901FLk', title: 'T1 vs Gen.G 半决赛', description: 'Worlds 2024 淘汰赛' },
        { id: 'OZj8C3jbRlY', title: 'T1 vs Gen.G Game4', description: 'Worlds 2024 精彩对局' },
    ],
    DOTA2: [
        { id: 'nJsAbXQ7DG0', title: 'TI13 总决赛', description: 'Liquid vs Gaimin Gladiators' },
        { id: 'VSa5aA3ajys', title: 'TI13 决赛 Game1', description: 'The International 2024' },
    ],
    CS2: [
        { id: '09N-bQbLrx8', title: 'Major 决赛 Map1', description: 'NAVI vs FaZe Ancient' },
        { id: 'vdXveK6G70g', title: 'Major 决赛 Map3', description: 'NAVI vs FaZe Inferno' },
    ],
};
const ALWAYS_LIVE = { id: 'jfKfPfyJRdk', title: 'Lofi Gaming Radio', description: '24/7 游戏音乐直播' };
interface EsportsLivePlayerProps {
    game: 'LOL' | 'DOTA2' | 'CS2';
    streamUrl?: string;
    matchStatus?: 'UPCOMING' | 'LIVE' | 'FINISHED';
    scheduledAt?: string;
    homeTeam?: string;
    awayTeam?: string;
    className?: string;
    onStatusChange?: () => void;
}
export function EsportsLivePlayer({ game, streamUrl, matchStatus, scheduledAt, homeTeam, awayTeam, className, onStatusChange, }: EsportsLivePlayerProps) {
    const [showPlayer, setShowPlayer] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [playerMode, setPlayerMode] = useState<'stream' | 'fallback' | 'countdown'>('fallback');
    const [countdown, setCountdown] = useState<string>('');
    const [fallbackIndex, setFallbackIndex] = useState(0);
    const fallbackVideos = FALLBACK_VIDEOS[game] || FALLBACK_VIDEOS.LOL;
    const currentFallback = fallbackVideos[fallbackIndex] || fallbackVideos[0];
    const [countdownData, setCountdownData] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isExpired: boolean;
    }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false });
    useEffect(() => {
        if (matchStatus === 'UPCOMING' && scheduledAt) {
            let wasExpired = false;
            const updateCountdown = () => {
                const now = new Date().getTime();
                const target = new Date(scheduledAt).getTime();
                const diff = target - now;
                const isExpired = diff <= 0;
                const absDiff = Math.abs(diff);
                const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);
                setCountdownData({ days, hours, minutes, seconds, isExpired });
                if (days > 0) {
                    setCountdown(`${days}天 ${hours}时 ${minutes}分`);
                }
                else if (hours > 0) {
                    setCountdown(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                }
                else {
                    setCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
                }
                if (isExpired && !wasExpired) {
                    wasExpired = true;
                    console.log('⏰ Match countdown expired, refreshing match data...');
                    if (onStatusChange) {
                        onStatusChange();
                    }
                    const refreshTimer = setInterval(() => {
                        if (onStatusChange) {
                            onStatusChange();
                        }
                    }, 30000);
                    setTimeout(() => {
                        clearInterval(refreshTimer);
                    }, 5 * 60 * 1000);
                }
            };
            updateCountdown();
            const timer = setInterval(updateCountdown, 1000);
            return () => clearInterval(timer);
        }
    }, [matchStatus, scheduledAt, onStatusChange]);
    const hasStream = !!streamUrl;
    useEffect(() => {
        if (hasStream && matchStatus !== 'FINISHED') {
            setPlayerMode('stream');
        }
        else if (matchStatus === 'UPCOMING') {
            setPlayerMode('countdown');
        }
        else {
            setPlayerMode('fallback');
        }
    }, [matchStatus, hasStream]);
    const getStreamPlatform = (url: string) => {
        for (const [domain, info] of Object.entries(STREAM_PLATFORMS)) {
            if (url.includes(domain)) {
                return info;
            }
        }
        return { name: '直播', Icon: YouTubeIcon, color: 'text-white' };
    };
    const GameIcon = GameIcons[game] || LOLIcon;
    const getEmbedUrl = () => {
        if (playerMode === 'stream' && streamUrl) {
            if (streamUrl.includes('player.twitch.tv')) {
                const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                const hasParent = streamUrl.includes('parent=');
                const hasMuted = streamUrl.includes('muted=');
                const connector = streamUrl.includes('?') ? '&' : '?';
                return `${streamUrl}${hasParent ? '' : `${connector}parent=${parent}`}${hasMuted ? '' : '&muted=true'}`;
            }
            if (streamUrl.includes('youtube.com/embed')) {
                return streamUrl.includes('?')
                    ? `${streamUrl}&autoplay=1&mute=1`
                    : `${streamUrl}?autoplay=1&mute=1`;
            }
            if (streamUrl.includes('twitch.tv')) {
                const channel = streamUrl.match(/twitch\.tv\/(\w+)/)?.[1];
                if (channel) {
                    const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                    return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`;
                }
            }
            if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
                const videoId = streamUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
                }
            }
        }
        return `https://www.youtube.com/embed/${currentFallback.id}?autoplay=1&mute=1&rel=0`;
    };
    if (!showPlayer) {
        return (<div className={cn("rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] overflow-hidden", className)}>
        <button onClick={() => setShowPlayer(true)} className="w-full p-4 flex items-center justify-center gap-3 text-white/60 hover:text-white hover:bg-white/5 transition-all group">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center group-hover:border-purple-500/40 transition-all">
            <GameIcon size={20}/>
          </div>
          <span className="text-sm font-bold">展开直播播放器</span>
          <svg className="w-4 h-4 text-white/40 group-hover:text-white transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      </div>);
    }
    return (<div className={cn("rounded-xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] to-[#0d0d0d] overflow-hidden", className)}>
      
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <GameIcon size={14}/>
          </div>
          
          {(matchStatus === 'LIVE' || (matchStatus === 'UPCOMING' && hasStream)) ? (<div className="flex items-center gap-1.5 sm:gap-2">
              <LiveIcon size={14} animate/>
              <span className="text-[10px] sm:text-xs font-bold text-red-400 uppercase tracking-wider">Live</span>
            </div>) : matchStatus === 'UPCOMING' ? (<div className="flex items-center gap-1.5 sm:gap-2">
              <UpcomingIcon size={14} className="text-yellow-400"/>
              <span className="text-[10px] sm:text-xs font-bold text-yellow-400">即将开始</span>
            </div>) : (<div className="flex items-center gap-1.5 sm:gap-2">
              <YouTubeIcon size={12} className="text-red-400"/>
              <span className="text-[10px] sm:text-xs font-bold text-white/60">精彩回放</span>
            </div>)}
          
          <div className="h-4 w-px bg-white/10 hidden sm:block"/>
          <span className="text-[10px] sm:text-xs text-white/50 font-medium hidden sm:inline">
            {game === 'LOL' ? '英雄联盟' : game === 'DOTA2' ? 'DOTA2' : 'CS2'}
          </span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {playerMode === 'fallback' && (<select value={fallbackIndex} onChange={(e) => {
                setFallbackIndex(Number(e.target.value));
                setIsLoading(true);
            }} className="bg-white/10 text-[10px] sm:text-xs text-white border border-white/10 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 cursor-pointer hover:bg-white/15 transition-all focus:outline-none focus:border-purple-500/50 max-w-[120px] sm:max-w-none">
              {fallbackVideos.map((video, idx) => (<option key={video.id} value={idx} className="bg-[#1a1a1a]">
                  {video.title}
                </option>))}
            </select>)}
          
          <button onClick={() => setShowPlayer(false)} className="text-white/40 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-all flex items-center gap-1">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 15l7-7 7 7"/>
            </svg>
            <span className="hidden sm:inline">收起</span>
          </button>
        </div>
      </div>

      
      <div className="relative aspect-video bg-black">
        {isLoading && (<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black to-purple-950/20 z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 border-2 border-purple-500/20 rounded-full"/>
                <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-purple-500 rounded-full animate-spin"/>
                <div className="absolute inset-2 w-8 h-8 border-2 border-transparent border-t-cyan-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}/>
              </div>
              <span className="text-xs text-white/50 font-medium">正在加载...</span>
            </div>
          </div>)}

        
        {playerMode === 'countdown' && (<div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/90 via-purple-950/80 to-pink-900/90 z-20 backdrop-blur-sm">
            <div className="text-center px-4 sm:px-8">
              <div className="relative mx-auto w-14 h-14 sm:w-20 sm:h-20 mb-3 sm:mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 animate-pulse"/>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <UpcomingIcon size={24} className="text-yellow-400 sm:hidden"/>
                  <UpcomingIcon size={32} className="text-yellow-400 hidden sm:block"/>
                </div>
              </div>
              
              <div className="text-sm sm:text-xl font-bold text-white mb-2 sm:mb-4">
                {homeTeam && awayTeam ? (<span className="flex items-center justify-center gap-2 sm:gap-3">
                    <span className="text-cyan-400 truncate max-w-[80px] sm:max-w-none">{homeTeam}</span>
                    <span className="text-white/40">vs</span>
                    <span className="text-pink-400 truncate max-w-[80px] sm:max-w-none">{awayTeam}</span>
                  </span>) : '比赛即将开始'}
              </div>
              
              <div className="flex items-center justify-center gap-1.5 sm:gap-3 mb-2">
                {countdownData.days > 0 && (<>
                    <div className="flex flex-col items-center">
                      <div className="text-2xl sm:text-4xl font-black text-white bg-white/10 rounded-lg px-2 sm:px-4 py-1 sm:py-2 min-w-[44px] sm:min-w-[70px]">
                        {countdownData.days}
                      </div>
                      <span className="text-[10px] sm:text-xs text-white/50 mt-0.5 sm:mt-1">天</span>
                    </div>
                    <span className="text-xl sm:text-3xl text-white/30 font-bold">:</span>
                  </>)}
                <div className="flex flex-col items-center">
                  <div className="text-2xl sm:text-4xl font-black text-white bg-white/10 rounded-lg px-2 sm:px-4 py-1 sm:py-2 min-w-[44px] sm:min-w-[70px] font-mono tabular-nums">
                    {countdownData.hours.toString().padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs text-white/50 mt-0.5 sm:mt-1">时</span>
                </div>
                <span className="text-xl sm:text-3xl text-white/30 font-bold">:</span>
                <div className="flex flex-col items-center">
                  <div className="text-2xl sm:text-4xl font-black text-white bg-white/10 rounded-lg px-2 sm:px-4 py-1 sm:py-2 min-w-[44px] sm:min-w-[70px] font-mono tabular-nums">
                    {countdownData.minutes.toString().padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs text-white/50 mt-0.5 sm:mt-1">分</span>
                </div>
                <span className="text-xl sm:text-3xl text-white/30 font-bold">:</span>
                <div className="flex flex-col items-center">
                  <div className={cn("text-2xl sm:text-4xl font-black rounded-lg px-2 sm:px-4 py-1 sm:py-2 min-w-[44px] sm:min-w-[70px] font-mono tabular-nums", countdownData.isExpired
                ? "text-orange-400 bg-orange-500/20"
                : "text-yellow-400 bg-yellow-500/20")}>
                    {countdownData.seconds.toString().padStart(2, '0')}
                  </div>
                  <span className="text-[10px] sm:text-xs text-white/50 mt-0.5 sm:mt-1">秒</span>
                </div>
              </div>

              {countdownData.isExpired && (<div className="text-xs sm:text-sm text-orange-400 mb-2 sm:mb-4 flex items-center justify-center gap-2">
                  <span className="animate-pulse">●</span>
                  比赛已超时，等待开始
                </div>)}
              
              <div className="text-[10px] sm:text-xs text-white/50 mt-2 sm:mt-4 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
                比赛开始后将自动切换至直播
              </div>
            </div>
          </div>)}
        
        <iframe src={getEmbedUrl()} title="电竞直播" width="100%" height="100%" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0" onLoad={() => setIsLoading(false)}/>
      </div>

      
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-purple-500/5 via-transparent to-pink-500/5 border-t border-white/10">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0">
            {hasStream && matchStatus !== 'FINISHED' ? (<>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                  {(() => {
                const platform = getStreamPlatform(streamUrl);
                return <platform.Icon size={14} className={cn(platform.color, "flex-shrink-0")}/>;
            })()}
                  {homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : '比赛直播中'}
                </div>
                <div className="text-[10px] sm:text-xs text-white/40 mt-0.5">
                  {getStreamPlatform(streamUrl).name} 官方直播
                </div>
              </>) : matchStatus === 'UPCOMING' ? (<>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                  <UpcomingIcon size={14} className="text-yellow-400 flex-shrink-0"/>
                  {homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : '下一场比赛'}
                </div>
                <div className="text-[10px] sm:text-xs text-white/40 mt-0.5">
                  {scheduledAt ? new Date(scheduledAt).toLocaleString('zh-CN') : '时间待定'}
                </div>
              </>) : (<>
                <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                  <YouTubeIcon size={14} className="text-red-400 flex-shrink-0"/>
                  {currentFallback.title}
                </div>
                <div className="text-[10px] sm:text-xs text-white/40 mt-0.5">
                  {matchStatus === 'LIVE' ? '暂无官方直播源' : currentFallback.description}
                </div>
              </>)}
          </div>
          
          {hasStream && (<a href={streamUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all flex-shrink-0 whitespace-nowrap">
              <span className="hidden sm:inline">打开</span>直播
              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>)}
        </div>
        
        {playerMode === 'fallback' && (<div className="pt-2.5 sm:pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <YouTubeIcon size={12} className="text-red-400"/>
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">精彩回放</span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {fallbackVideos.map((video, idx) => (<button key={video.id} onClick={() => {
                    setFallbackIndex(idx);
                    setIsLoading(true);
                }} className={cn("px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] font-medium transition-all", fallbackIndex === idx
                    ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg shadow-red-500/20"
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 hover:text-white")}>
                  {video.title.slice(0, 12)}
                </button>))}
              <button onClick={() => {
                setFallbackIndex(-1);
                setIsLoading(true);
            }} className={cn("px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1", fallbackIndex === -1
                ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/20"
                : "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20")}>
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"/>
                24/7
              </button>
            </div>
          </div>)}
      </div>
    </div>);
}
interface MiniLivePlayerProps {
    streamUrl?: string;
    game: 'LOL' | 'DOTA2' | 'CS2';
    matchStatus?: 'UPCOMING' | 'LIVE' | 'FINISHED';
}
export function MiniLivePlayer({ streamUrl, game, matchStatus }: MiniLivePlayerProps) {
    const [showPlayer, setShowPlayer] = useState(false);
    const fallbackVideos = FALLBACK_VIDEOS[game] || FALLBACK_VIDEOS.LOL;
    const fallback = fallbackVideos[0];
    const getEmbedUrl = () => {
        const canStream = !!streamUrl && matchStatus !== 'FINISHED';
        if (canStream && streamUrl) {
            if (streamUrl.includes('player.twitch.tv')) {
                const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                const hasParent = streamUrl.includes('parent=');
                const hasMuted = streamUrl.includes('muted=');
                const connector = streamUrl.includes('?') ? '&' : '?';
                return `${streamUrl}${hasParent ? '' : `${connector}parent=${parent}`}${hasMuted ? '' : '&muted=true'}`;
            }
            if (streamUrl.includes('youtube.com/embed')) {
                return streamUrl.includes('?')
                    ? `${streamUrl}&autoplay=1&mute=1`
                    : `${streamUrl}?autoplay=1&mute=1`;
            }
            if (streamUrl.includes('twitch.tv')) {
                const channel = streamUrl.match(/twitch\.tv\/(\w+)/)?.[1];
                if (channel) {
                    const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
                    return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=true`;
                }
            }
            if (streamUrl.includes('youtube.com') || streamUrl.includes('youtu.be')) {
                const videoId = streamUrl.match(/(?:v=|youtu\.be\/)([^&\s]+)/)?.[1];
                if (videoId) {
                    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
                }
            }
        }
        return `https://www.youtube.com/embed/${fallback.id}?autoplay=1&mute=1&rel=0`;
    };
    if (!showPlayer) {
        return (<button onClick={() => setShowPlayer(true)} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-[10px] font-medium", matchStatus === 'LIVE'
                ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40"
                : "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40")}>
        {matchStatus === 'LIVE' ? (<>
            <LiveIcon size={12}/>
            观看直播
          </>) : (<>
            <YouTubeIcon size={12}/>
            看回放
          </>)}
      </button>);
    }
    return (<div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black/50">
      <div className="relative aspect-video bg-black">
        <iframe src={getEmbedUrl()} title="比赛视频" width="100%" height="100%" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="absolute inset-0"/>
      </div>
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-black/80 to-transparent">
        <span className="text-[10px] text-white/60 flex items-center gap-1.5">
          {matchStatus === 'LIVE' ? (<>
              <LiveIcon size={10}/>
              直播中
            </>) : (<>
              <YouTubeIcon size={10} className="text-red-400"/>
              {fallback.title}
            </>)}
        </span>
        <button onClick={() => setShowPlayer(false)} className="text-[10px] text-white/40 hover:text-white transition-all flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/10">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 15l7-7 7 7"/>
          </svg>
          收起
        </button>
      </div>
    </div>);
}

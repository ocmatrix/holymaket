"use client";
import { useState, type ReactElement } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { useLanguageStore } from "@/stores/language-store";
import { translations } from "@/lib/translations";
import { BRAND } from "@/lib/brand";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ReferralPanel } from "@/components/referral/referral-panel";
import { FloatingOctopus, InkParticles, TentacleWaves } from "@/components/ui/octopus-decorations";
import { SparklesCore } from "@/components/aceternity/sparkles";
import { OctoProfile, OctoWallet } from "@/components/icons/octopus-icons";
import { useXMarketChainState } from "@/hooks/use-xmarket-chain-state";
import { XMARKET_NETWORK } from "@/lib/contracts";
import {
    useIndexerUserClaims,
    useIndexerUserPositions,
    useIndexerUserTrades,
} from "@/lib/indexer/hooks";
import { isIndexerUnavailableError } from "@/lib/indexer/client";
import { useBalance } from "wagmi";
import { formatEther } from "viem";
import { bscTestnet } from "viem/chains";
import { usePrivy, useWallets } from "@privy-io/react-auth";
const WALLET_DISPLAY_CHAIN_NAME = "BNB Smart Chain Testnet";
const OctoIcons = {
    Edit: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>),
    X: () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>),
    Save: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>),
    User: () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="9" rx="6" ry="5"/>
      <circle cx="10" cy="8" r="1" fill="currentColor"/>
      <circle cx="14" cy="8" r="1" fill="currentColor"/>
      <path d="M7 13c-1 2-1 4 0 5" strokeLinecap="round" opacity="0.5"/>
      <path d="M10 14c0 2 0 4 0 5" strokeLinecap="round" opacity="0.4"/>
      <path d="M14 14c0 2 0 4 0 5" strokeLinecap="round" opacity="0.4"/>
      <path d="M17 13c1 2 1 4 0 5" strokeLinecap="round" opacity="0.5"/>
    </svg>),
    Copy: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="11" height="11" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>),
    Check: () => (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 10l3 3 5-6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>),
    Points: () => (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="10" rx="6" ry="5"/>
      <circle cx="10" cy="9" r="1.5" fill="currentColor"/>
      <circle cx="14" cy="9" r="1.5" fill="currentColor"/>
      <path d="M6 14c-2 1-3 3-2 5" strokeLinecap="round"/>
      <path d="M9 15c-1 2-1 4 0 5" strokeLinecap="round" opacity="0.7"/>
      <path d="M12 15c0 2 0 4 0 5" strokeLinecap="round" opacity="0.5"/>
      <path d="M15 15c1 2 1 4 0 5" strokeLinecap="round" opacity="0.7"/>
      <path d="M18 14c2 1 3 3 2 5" strokeLinecap="round"/>
    </svg>),
    Position: () => (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="10" r="6" opacity="0.2"/>
      <ellipse cx="12" cy="10" rx="4" ry="3"/>
      <circle cx="12" cy="10" r="1.5" fill="currentColor"/>
    </svg>),
    WinRate: () => (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5l2-5z"/>
    </svg>),
    ROI: () => (<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 18l4-4 4 4 8-10"/>
      <path d="M16 4h4v4"/>
    </svg>),
    Wallet: () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="6" width="18" height="12" rx="2"/>
      <path d="M3 10h18" opacity="0.3"/>
      <circle cx="16" cy="13" r="1.5" fill="currentColor"/>
    </svg>),
    Google: () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>),
    Twitter: () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z"/>
    </svg>),
    Discord: () => (<svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.048-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>),
};
const OctopusAvatar = ({ username }: {
    username: string;
}) => (<div className="relative w-28 h-28 overflow-hidden rounded-2xl bg-black/20 border border-white/5">
    <img src={BRAND.logoPath} alt="User Avatar" className="w-full h-full object-cover mix-blend-screen scale-125" style={{ filter: 'brightness(1.1) contrast(1.1) drop-shadow(0 0 10px rgba(0,242,255,0.3))' }}/>
  </div>);
const OctoStatCard = ({ stat, index }: {
    stat: any;
    index: number;
}) => {
    const iconMap: Record<string, ReactElement> = {
        'PTS': <OctoIcons.Points />,
        'Active Positions': <OctoIcons.Position />,
        'Win Rate': <OctoIcons.WinRate />,
        'Total ROI': <OctoIcons.ROI />,
    };
    return (<motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: index * 0.1, type: "spring" }} className="relative group">
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 blur opacity-0 group-hover:opacity-100 transition-opacity"/>
      <div className="relative bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-2xl p-5 overflow-hidden group-hover:border-cyan-500/30 transition-all">
        <motion.div className="text-cyan-400 mb-3" animate={{ y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity, delay: index * 0.2 }}>
          {iconMap[stat.label] || <OctoIcons.Points />}
        </motion.div>
        <p className="text-[9px] font-bold uppercase text-white/40 tracking-widest mb-1">{stat.label}</p>
        <p className="text-2xl font-black text-white">{stat.value}</p>
        {stat.sub && <p className="text-[10px] text-white/30 mt-1">{stat.sub}</p>}
      </div>
    </motion.div>);
};
const OctoAccountCard = ({ account, index, onClick }: {
    account: any;
    index: number;
    onClick?: () => void;
}) => (<motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className={`relative group ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
    <div className={`relative bg-gradient-to-r ${account.connected ? 'from-cyan-500/10 to-purple-500/10 border-cyan-500/20' : 'from-white/[0.02] to-transparent border-white/5'} border rounded-xl p-4 overflow-hidden group-hover:border-cyan-500/30 transition-all`}>
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${account.connected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-white/30'}`}>
            {account.icon}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{account.type}</p>
            <p className={`text-xs font-mono font-bold ${account.connected ? 'text-white' : 'text-white/20'}`}>
              {account.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!account.connected ? (<span className="text-[9px] font-black text-cyan-400 border border-cyan-400/30 px-2 py-1 rounded bg-cyan-400/5 group-hover:bg-cyan-400 group-hover:text-black transition-all">
              {account.linkText || 'LINK'}
            </span>) : (<div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <motion.div className="w-2 h-2 rounded-full bg-green-400" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}/>
              </div>
            </div>)}
        </div>
      </div>
    </div>
  </motion.div>);
export default function ProfilePageContent() {
    const { user: authUser, linkWallet, linkTwitter, linkDiscord, linkEmail } = useAuth();
    const { user: privyUser } = usePrivy();
    const { currentLanguage } = useLanguageStore();
    const t = translations[currentLanguage] || translations["en"];
    const queryClient = useQueryClient();
    const { profile: userProfile, refetch: refetchProfile } = useProfile(authUser?.id || "");
    const [showEditModal, setShowEditModal] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const { wallets: privyWallets } = useWallets();
    const activeWallet = privyWallets[0];
    const walletAddress = activeWallet?.address as `0x${string}` | undefined;
    const isWalletReady = !!activeWallet && !!walletAddress;
    const indexerAddress = walletAddress || authUser?.address;
    const { data: walletBalance } = useBalance({ address: walletAddress, chainId: bscTestnet.id });
    const { formattedMockUsdtBalance, isConnected: isChainWalletConnected, loading: chainStateLoading, mockUsdtSymbol } = useXMarketChainState();
    const { data: indexedPositions, isLoading: indexedPositionsLoading, error: indexedPositionsError } = useIndexerUserPositions(indexerAddress);
    const { data: indexedTrades, isLoading: indexedTradesLoading, error: indexedTradesError } = useIndexerUserTrades(indexerAddress);
    const { data: indexedClaims, isLoading: indexedClaimsLoading, error: indexedClaimsError } = useIndexerUserClaims(indexerAddress);
    const updateUsernameMutation = useMutation({
        mutationFn: (username: string) => api.updateUsername(authUser!.id, username),
        onSuccess: () => {
            setShowEditModal(false);
            setNewUsername("");
            refetchProfile();
            queryClient.invalidateQueries({ queryKey: ["userProfile", authUser?.id] });
        },
    });
    const notConnectedText = t.profile?.notConnected || "Not connected";
    const linkNowText = t.profile?.linkNow || "LINK_NOW";
    const isGoogleLinked = !!privyUser?.google;
    const isTwitterLinked = !!privyUser?.twitter || !!authUser?.twitterId;
    const isDiscordLinked = !!privyUser?.discord || !!authUser?.discordId;
    const googleLabel = privyUser?.google?.email || authUser?.email || notConnectedText;
    const twitterLabel = privyUser?.twitter?.username || authUser?.twitterId || notConnectedText;
    const discordLabel = privyUser?.discord?.username || authUser?.discordId || notConnectedText;
    const activeIndexedPositions = (indexedPositions || []).filter((position) => position.yesShares !== "0" || position.noShares !== "0");
    const highlightedPositions = activeIndexedPositions.slice(0, 3);
    const indexerUnavailable = [
        indexedPositionsError,
        indexedTradesError,
        indexedClaimsError,
    ].some(isIndexerUnavailableError);
    const indexedSummaryError = ([
        indexedPositionsError,
        indexedTradesError,
        indexedClaimsError,
    ].filter(Boolean)[0] || null) as Error | null;
    const connectedAccounts = [
        { type: "Wallet", label: authUser?.address ? `${authUser.address.slice(0, 6)}...${authUser.address.slice(-4)}` : notConnectedText, connected: !!authUser?.address, icon: <OctoIcons.Wallet />, action: linkWallet, linkText: linkNowText },
        { type: "Google", label: googleLabel, connected: isGoogleLinked, icon: <OctoIcons.Google />, action: linkEmail, linkText: linkNowText },
        { type: "Twitter", label: twitterLabel, connected: isTwitterLinked, icon: <OctoIcons.Twitter />, action: linkTwitter, linkText: linkNowText },
        { type: "Discord", label: discordLabel, connected: isDiscordLinked, icon: <OctoIcons.Discord />, action: linkDiscord, linkText: linkNowText },
    ];
    const stats = [
        { label: t.profile?.points || "PTS", value: userProfile?.pts || 0, sub: t.profile?.totalPoints || "Total Points" },
        { label: t.profile?.activePositions || "Active Positions", value: indexerAddress ? activeIndexedPositions.length : 0, sub: indexerAddress ? "Indexed positions" : (t.profile?.currentlyOpen || "Currently open") },
        { label: t.profile?.winRate || "Win Rate", value: userProfile?.winRate ? `${(userProfile.winRate * 100).toFixed(1)}%` : "0%", sub: t.profile?.allTime || "All time" },
        { label: t.profile?.totalRoi || "Total ROI", value: userProfile?.roi ? `${userProfile.roi}%` : "0%", sub: t.profile?.return || "Return" },
    ];
    return (<div className="relative min-h-screen bg-transparent text-white overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <SparklesCore background="transparent" minSize={0.3} maxSize={0.8} particleDensity={25} particleColor="#06b6d4" className="opacity-40"/>
        <InkParticles count={30}/>
        <div className="absolute -top-[20%] -left-[15%] w-[60%] h-[60%] bg-cyan-900/20 blur-[200px] rounded-full"/>
        <div className="absolute top-[40%] -right-[15%] w-[50%] h-[50%] bg-purple-900/20 blur-[180px] rounded-full"/>
      </div>
      <TentacleWaves />
      <FloatingOctopus className="absolute top-20 right-10 opacity-25 hidden xl:block" size="lg" color="cyan"/>
      <FloatingOctopus className="absolute top-1/3 left-5 opacity-20 hidden lg:block" size="md" color="purple"/>

      <div className="relative max-w-6xl mx-auto px-4 py-8 lg:py-12">
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="relative mb-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="flex-shrink-0 bg-transparent rounded-lg">
              <OctopusAvatar username={authUser?.username || userProfile?.username || "Explorer"}/>
            </div>
            <div className="flex-1 text-center md:text-left min-w-0">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                <motion.span className="text-cyan-400 flex-shrink-0" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <OctoProfile className="w-6 h-6"/>
                </motion.span>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">{t.profile?.octopusProfile || "Profile"}</span>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight break-all">
                  {authUser?.username || userProfile?.username || "Explorer"}
                </h1>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowEditModal(true)} className="inline-flex items-center gap-1.5 bg-neon-purple/10 px-3 py-1.5 rounded-full border border-neon-purple/30 text-[10px] font-bold text-white hover:bg-neon-purple/20 transition-all flex-shrink-0">
                  <OctoIcons.Edit />
                  {t.profile?.editProfile || "Edit"}
                </motion.button>
              </div>
              <p className="text-sm text-white/40 max-w-md mx-auto md:mx-0">{t.profile?.desc || "Manage your account, balance and preferences"}</p>
            </div>
          </div>
        </motion.div>

        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, index) => <OctoStatCard key={stat.label} stat={stat} index={index}/>)}
        </div>

        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-cyan-400">
                <OctoWallet className="w-8 h-8"/>
              </motion.div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  {t.profile?.walletBalance || "Wallet"} <span className="text-cyan-400">& PTS</span>
                </h3>
                <p className="text-xs text-white/40">链上金库与充值/提现已移除；钱包仍可用于登录与签名。</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <OctoIcons.Wallet />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.profile?.walletBalance || "Wallet"}</span>
                </div>
                {isWalletReady && walletBalance ? (<>
                    <p className="text-2xl font-black text-white">{parseFloat(formatEther(walletBalance.value)).toFixed(4)} {walletBalance.symbol}</p>
                    <p className="text-[10px] text-white/30 mt-1">{WALLET_DISPLAY_CHAIN_NAME}（参考）</p>
                  </>) : isWalletReady ? (<>
                    <p className="text-lg font-black text-cyan-400/70 animate-pulse">Loading...</p>
                    <p className="text-[10px] text-white/30 mt-1">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</p>
                  </>) : authUser?.address ? (<>
                    <p className="text-lg font-black text-cyan-400/70 animate-pulse">Connecting...</p>
                    <p className="text-[10px] text-white/30 mt-1">{authUser.address.slice(0, 6)}...{authUser.address.slice(-4)}</p>
                  </>) : (<>
                    <p className="text-lg font-black text-white/30">-- --</p>
                    <p className="text-[10px] text-white/30 mt-1">{t.profile?.notConnected || 'Not connected'}</p>
                  </>)}
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <OctoIcons.Points />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">{t.profile?.platformPts || "Platform PTS"}</span>
                </div>
                <p className="text-2xl font-black text-cyan-400">{(userProfile?.pts || 0).toLocaleString()} PTS</p>
                <p className="text-[10px] text-white/30 mt-1">{t.profile?.availableToUse || "Available"}</p>
              </div>
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <OctoIcons.Wallet />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">mUSDT on {XMARKET_NETWORK.name}</span>
                </div>
                {isChainWalletConnected ? (<>
                    <p className="text-2xl font-black text-cyan-300">{formattedMockUsdtBalance || (chainStateLoading ? "Loading..." : "0")} {mockUsdtSymbol || "mUSDT"}</p>
                    <p className="text-[10px] text-white/30 mt-1">Read-only chain state</p>
                  </>) : (<>
                    <p className="text-lg font-black text-white/30">-- --</p>
                    <p className="text-[10px] text-white/30 mt-1">Connect wallet to view mUSDT balance</p>
                  </>)}
              </div>
            </div>
            {!isWalletReady && !authUser?.address && (<div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                <p className="text-xs font-bold text-cyan-400 mb-2">{t.profile?.connectWallet || 'Connect Wallet'}</p>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={linkWallet} className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-400 border border-cyan-500/30">
                  {t.profile?.linkNow || 'LINK_NOW'}
                </motion.button>
              </div>)}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3 mb-6">
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 2.5, repeat: Infinity }} className="text-purple-400">
                <OctoIcons.Position />
              </motion.div>
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">
                  Indexed <span className="text-purple-400">Summary</span>
                </h3>
                <p className="text-xs text-white/40">Profile summary is read from the Indexer Read API only.</p>
              </div>
            </div>

            {!indexerAddress ? (<div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/50">
                Connect wallet to view indexed positions, trades and claims
              </div>) : indexerUnavailable ? (<div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
                <p>Indexer data unavailable</p>
                <p className="mt-1 text-yellow-200/70">On-chain trading remains available</p>
              </div>) : indexedSummaryError ? (<div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {indexedSummaryError.message}
              </div>) : (<>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexed Positions</p>
                    <p className="mt-2 text-2xl font-black text-white">{indexedPositionsLoading ? "..." : activeIndexedPositions.length}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexed Trades</p>
                    <p className="mt-2 text-2xl font-black text-white">{indexedTradesLoading ? "..." : (indexedTrades?.length || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Indexed Claims</p>
                    <p className="mt-2 text-2xl font-black text-white">{indexedClaimsLoading ? "..." : (indexedClaims?.length || 0)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Main Holdings</p>
                  {indexedPositionsLoading ? (<p className="mt-3 text-sm text-white/45">Loading indexed holdings...</p>) : highlightedPositions.length > 0 ? (<div className="mt-3 space-y-3">
                      {highlightedPositions.map((position) => (<div key={`${position.marketAddress}-${position.userAddress}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/65">
                          <p className="break-all text-white/80">{position.marketAddress}</p>
                          <p className="mt-2">YES shares: <span className="text-white">{position.yesShares}</span></p>
                          <p className="mt-1">NO shares: <span className="text-white">{position.noShares}</span></p>
                          <p className="mt-1">claimed: <span className="text-white">{String(position.claimed)}</span> · refunded: <span className="text-white">{String(position.refunded)}</span></p>
                        </div>))}
                    </div>) : (<p className="mt-3 text-sm text-white/45">No indexed positions yet</p>)}
                </div>
              </>)}
          </div>
        </motion.div>

        
        {authUser?.id && (userProfile?.referralCode || authUser?.referralCode) && (<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <ReferralPanel userId={authUser.id} referralCode={userProfile?.referralCode || authUser?.referralCode || ""}/>
          </motion.div>)}

        
        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-5">
              <motion.svg className="w-8 h-8 text-cyan-400" viewBox="0 0 32 32" animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <ellipse cx="16" cy="12" rx="10" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <circle cx="12" cy="11" r="2" fill="currentColor"/>
                <circle cx="20" cy="11" r="2" fill="currentColor"/>
                <path d="M6 18c-2 2-3 5-2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M26 18c2 2 3 5 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </motion.svg>
              <h3 className="text-xl font-black uppercase tracking-tight">
                {t.profile?.connectedTentacles || 'Connected'} <span className="text-cyan-400">Tentacles</span>
              </h3>
            </div>
            <div className="space-y-3">
              {connectedAccounts.map((account, index) => (<OctoAccountCard key={account.type} account={account} index={index} onClick={account.action}/>))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-5">
              <motion.svg className="w-8 h-8 text-purple-400" viewBox="0 0 32 32" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                <ellipse cx="16" cy="14" rx="10" ry="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                <circle cx="12" cy="13" r="2" fill="currentColor"/>
                <circle cx="20" cy="13" r="2" fill="currentColor"/>
                <path d="M16 22v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
              </motion.svg>
              <h3 className="text-xl font-black uppercase tracking-tight">
                {t.profile?.inkTrail || 'Ink'} <span className="text-purple-400">Trail</span>
              </h3>
            </div>
            <div className="relative bg-white/[0.02] border border-white/10 rounded-2xl p-4 overflow-hidden">
              <motion.div className="flex flex-col items-center justify-center py-12 text-center relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.svg className="w-20 h-20 text-white/10 mb-4" viewBox="0 0 80 80" animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                  <ellipse cx="40" cy="30" rx="20" ry="15" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <circle cx="35" cy="28" r="3" fill="currentColor"/>
                  <circle cx="45" cy="28" r="3" fill="currentColor"/>
                </motion.svg>
                <p className="text-sm text-white/30">链上充值/提现流水已随金库接口移除</p>
                <p className="text-xs text-white/20 mt-1">平台内 PTS 与仓位记录仍在其他页面展示</p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      
      <AnimatePresence>
        {showEditModal && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowEditModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#0a0a0a] rounded-2xl border border-white/10 w-full max-w-md p-6 relative overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowEditModal(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white">
                <OctoIcons.X />
              </button>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-white mb-2">{t.profile?.updateProfile || 'Edit Profile'}</h2>
                <p className="text-sm text-white/40">{t.profile?.updateIdentity || 'Update your identity'}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 block">{t.profile?.username || 'Username'}</label>
                  <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder={authUser?.username || "Enter new username"} className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors" maxLength={20}/>
                </div>
                {authUser?.address && (<div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2 block">{t.profile?.walletAddress || 'Wallet'}</label>
                    <div className="px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-white/40 font-mono text-xs">{authUser.address}</div>
                  </div>)}
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-all">
                  {t.profile?.cancel || 'Cancel'}
                </button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { if (newUsername.trim() && newUsername.length >= 3)
            updateUsernameMutation.mutate(newUsername.trim()); }} disabled={!newUsername.trim() || newUsername.length < 3 || updateUsernameMutation.isPending} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold text-sm uppercase tracking-wider hover:bg-cyan-500/30 transition-all disabled:opacity-50">
                  {updateUsernameMutation.isPending ? 'Saving...' : <><OctoIcons.Save /> {t.profile?.saveChanges || 'Save'}</>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>)}
      </AnimatePresence>
    </div>);
}

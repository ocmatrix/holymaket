"use client";
import { useState, useEffect } from "react";
import { useLanguageStore } from "../../stores/language-store";
import { translations } from "../../lib/translations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Market } from "../../lib/api";
import { useAuth } from "../../hooks/use-auth";
import { useUIStore } from "../../stores/ui-store";
const ROUND_DURATION = 10;
interface PositionButtonsProps {
    market?: Market;
    activeTab: 'C10' | 'GOLD';
    betAmount?: number;
}
export function PositionButtons({ market, activeTab, betAmount = 10 }: PositionButtonsProps) {
    const currentLanguage = useLanguageStore(s => s.currentLanguage);
    const t = translations[currentLanguage] || translations["en"];
    const queryClient = useQueryClient();
    const { user: authUser } = useAuth();
    const showNotification = useUIStore(s => s.showNotification);
    const [countdown, setCountdown] = useState(ROUND_DURATION);
    const [roundNumber, setRoundNumber] = useState(0);
    useEffect(() => {
        const updateCountdown = () => {
            const now = Math.floor(Date.now() / 1000);
            const roundStart = Math.floor(now / ROUND_DURATION) * ROUND_DURATION;
            const elapsed = now - roundStart;
            const remaining = ROUND_DURATION - elapsed;
            setCountdown(remaining);
            setRoundNumber(Math.floor(now / ROUND_DURATION));
        };
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, []);
    const mutation = useMutation({
        mutationFn: (data: {
            position: 'YES' | 'NO';
            amount: number;
        }) => api.placeBet(market?.id || "", { userId: authUser?.id, ...data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["markets"] });
            queryClient.invalidateQueries({ queryKey: ["userProfile", authUser?.id] });
            showNotification(currentLanguage === 'zh-TW' ? '✅ 預測已提交！' : '✅ Prediction submitted!', 'SUCCESS');
        },
        onError: (error: any) => showNotification(`${currentLanguage === 'zh-TW' ? '❌ 提交失敗' : '❌ Submission failed'}: ${error.message}`, 'ERROR')
    });
    const handleBet = (pos: 'YES' | 'NO') => {
        if (!market)
            return;
        if (countdown <= 3) {
            showNotification(currentLanguage === 'zh-TW' ? '⏰ 回合即將結算，請等待下一回合' : '⏰ Round closing, wait for next round', 'WARNING');
            return;
        }
        mutation.mutate({ position: pos, amount: betAmount });
    };
    const isDisabled = countdown <= 3 || mutation.isPending;
    return (<div className="flex flex-col gap-2 w-full px-0.5">
      
      <div className="flex items-center justify-between px-2 py-1.5 bg-white/[0.02] rounded-lg border border-white/5">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${countdown <= 3 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}/>
          <span className="text-[10px] font-bold text-white/40 uppercase">
            Round #{roundNumber}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">{countdown <= 3 ? 'Settling...' : 'Open'}</span>
          <span className={`text-lg font-black tabular-nums ${countdown <= 3 ? 'text-red-500' : 'text-cyan-400'}`}>
            {countdown}s
          </span>
        </div>
      </div>

      
      <div className="flex gap-2">
        <button onClick={() => handleBet('YES')} disabled={isDisabled} data-hotkey="LONG" className={`flex-1 min-w-0 relative overflow-hidden rounded-xl border p-2.5 sm:p-6 text-left transition-all active:scale-95 h-14 sm:h-20 ${isDisabled
            ? 'border-gray-500/20 bg-gray-500/5 opacity-50 cursor-not-allowed'
            : 'border-green-500/20 bg-green-500/5 hover:bg-green-500/10'}`}>
          <span className={`text-[7px] sm:text-[10px] font-black uppercase block mb-1 ${isDisabled ? 'text-gray-400' : 'text-green-500'}`}>
            {isDisabled ? (currentLanguage === 'zh-TW' ? '等待中' : 'WAIT') : 'UP (W)'}
          </span>
          <span className="text-sm sm:text-2xl font-black text-white italic truncate block uppercase">LONG</span>
          <span className={`absolute right-1 bottom-1 text-2xl font-black italic ${isDisabled ? 'text-gray-500/5' : 'text-green-500/5'}`}>↗</span>
        </button>

        <button onClick={() => handleBet('NO')} disabled={isDisabled} data-hotkey="SHORT" className={`flex-1 min-w-0 relative overflow-hidden rounded-xl border p-2.5 sm:p-6 text-left transition-all active:scale-95 h-14 sm:h-20 ${isDisabled
            ? 'border-gray-500/20 bg-gray-500/5 opacity-50 cursor-not-allowed'
            : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'}`}>
          <span className={`text-[7px] sm:text-[10px] font-black uppercase block mb-1 ${isDisabled ? 'text-gray-400' : 'text-red-500'}`}>
            {isDisabled ? (currentLanguage === 'zh-TW' ? '等待中' : 'WAIT') : 'DOWN (S)'}
          </span>
          <span className="text-sm sm:text-2xl font-black text-white italic truncate block uppercase">SHORT</span>
          <span className={`absolute right-1 bottom-1 text-2xl font-black italic ${isDisabled ? 'text-gray-500/5' : 'text-red-500/5'}`}>↘</span>
        </button>
      </div>
    </div>);
}

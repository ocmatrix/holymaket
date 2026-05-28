'use client';
import React from 'react';
import { BettingPoolStats } from '@/hooks/useFootballLive';
interface BettingStatsProps {
    stats: BettingPoolStats | null;
}
export function BettingStats({ stats }: BettingStatsProps) {
    if (!stats) {
        return (<div className="rounded-lg border border-gray-500/30 bg-gray-500/5 p-6 text-center">
        <p className="text-sm text-gray-500">Betting data not available</p>
      </div>);
    }
    const totalBets = stats.homeBetCount + stats.drawBetCount + stats.awayBetCount;
    const homePercent = stats.totalPool > 0 ? (stats.homeBetPool / stats.totalPool) * 100 : 0;
    const drawPercent = stats.totalPool > 0 ? (stats.drawBetPool / stats.totalPool) * 100 : 0;
    const awayPercent = stats.totalPool > 0 ? (stats.awayBetPool / stats.totalPool) * 100 : 0;
    const BettingOption = ({ label, pool, count, percent, color, }: {
        label: string;
        pool: number;
        count: number;
        percent: number;
        color: string;
    }) => (<div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm font-bold text-white">{percent.toFixed(1)}%</p>
      </div>

      
      <div className="h-2 overflow-hidden rounded-full bg-gray-700">
        <div className={`h-full transition-all duration-500 bg-gradient-to-r ${color}`} style={{ width: `${percent}%` }}/>
      </div>

      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-white/5 p-2">
          <p className="text-gray-500">Pool</p>
          <p className="font-bold">${pool.toFixed(0)}</p>
        </div>
        <div className="rounded bg-white/5 p-2">
          <p className="text-gray-500">Bets</p>
          <p className="font-bold">{count}</p>
        </div>
      </div>
    </div>);
    return (<div className="space-y-4">
      
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Betting Stats</h3>
        <div className="text-right">
          <p className="text-xs text-gray-500">Total Pool</p>
          <p className="text-lg font-bold text-green-400">${stats.totalPool.toFixed(0)}</p>
        </div>
      </div>

      
      <BettingOption label="🏠 HOME WIN" pool={stats.homeBetPool} count={stats.homeBetCount} percent={homePercent} color="from-blue-500 to-blue-600"/>

      
      <BettingOption label="🤝 DRAW" pool={stats.drawBetPool} count={stats.drawBetCount} percent={drawPercent} color="from-purple-500 to-purple-600"/>

      
      <BettingOption label="✈️ AWAY WIN" pool={stats.awayBetPool} count={stats.awayBetCount} percent={awayPercent} color="from-red-500 to-red-600"/>

      
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-gray-500">Total Bets</p>
            <p className="text-lg font-bold">{totalBets}</p>
          </div>
          <div>
            <p className="text-gray-500">Avg Bet</p>
            <p className="text-lg font-bold">
              ${totalBets > 0 ? (stats.totalPool / totalBets).toFixed(0) : 0}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Most Popular</p>
            <p className="text-lg font-bold">
              {Math.max(homePercent, drawPercent, awayPercent) === homePercent
            ? '🏠'
            : Math.max(homePercent, drawPercent, awayPercent) === drawPercent
                ? '🤝'
                : '✈️'}
            </p>
          </div>
        </div>
      </div>
    </div>);
}

'use client';
import React, { useState, useEffect } from 'react';
import { FootballEvent } from '@/hooks/useFootballLive';
interface MatchEventsProps {
    events: FootballEvent[];
    matchId: string;
}
export function MatchEvents({ events, matchId }: MatchEventsProps) {
    const [sortedEvents, setSortedEvents] = useState<FootballEvent[]>([]);
    useEffect(() => {
        setSortedEvents([...events].sort((a, b) => b.minute - a.minute));
    }, [events]);
    const getEventIcon = (type: string) => {
        switch (type) {
            case 'GOAL':
                return '⚽';
            case 'OWN_GOAL':
                return '🔄';
            case 'PENALTY':
                return '👟';
            case 'RED_CARD':
                return '🔴';
            case 'YELLOW_CARD':
                return '🟡';
            case 'SUBSTITUTION':
                return '🔁';
            case 'VAR':
                return '📹';
            case 'MATCH_START':
                return '🏁';
            case 'HALFTIME':
                return '⏸️';
            case 'FULLTIME':
                return '✅';
            case 'EXTRA_TIME':
                return '⏱️';
            case 'PENALTY_SHOOTOUT':
                return '🎯';
            default:
                return '📌';
        }
    };
    const getEventColor = (type: string, team: 'HOME' | 'AWAY') => {
        const baseColor = team === 'HOME' ? 'text-blue-400' : 'text-red-400';
        switch (type) {
            case 'GOAL':
            case 'OWN_GOAL':
                return 'bg-green-500/20 border-green-500/50 ' + baseColor;
            case 'RED_CARD':
                return 'bg-red-500/20 border-red-500/50 text-red-400';
            case 'YELLOW_CARD':
                return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
            case 'SUBSTITUTION':
                return 'bg-blue-500/10 border-blue-500/30 ' + baseColor;
            default:
                return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
        }
    };
    const getEventDescription = (event: FootballEvent) => {
        switch (event.type) {
            case 'GOAL':
                return `${event.player.name} scores!${event.relatedPlayer ? ` (Assist: ${event.relatedPlayer.name})` : ''}`;
            case 'OWN_GOAL':
                return `${event.player.name} scores own goal!`;
            case 'YELLOW_CARD':
                return `${event.player.name} receives yellow card`;
            case 'RED_CARD':
                return `${event.player.name} receives red card`;
            case 'SUBSTITUTION':
                return `${event.player.name} → ${event.relatedPlayer?.name} (sub)`;
            case 'VAR':
                return `VAR Review: ${event.detail || 'pending'}`;
            default:
                return `${event.player.name} - ${event.detail || event.type}`;
        }
    };
    if (sortedEvents.length === 0) {
        return (<div className="rounded-lg border border-gray-500/30 bg-gray-500/5 p-6 text-center">
        <p className="text-sm text-gray-500">No events yet</p>
      </div>);
    }
    return (<div className="space-y-2">
      {sortedEvents.map((event) => (<div key={event.id} className={`
            rounded-lg border-2 p-3 transition-all duration-200
            ${getEventColor(event.type, event.team)}
          `}>
          <div className="flex items-start gap-3">
            
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl">{getEventIcon(event.type)}</span>
              <span className="whitespace-nowrap text-xs font-bold">{event.minute}'</span>
            </div>

            
            <div className="flex-1">
              <p className="text-sm font-semibold">{getEventDescription(event)}</p>
              {event.detail && (<p className="mt-1 text-xs opacity-75">
                  {event.detail}
                </p>)}
            </div>

            
            <div className="rounded-full px-2 py-1 text-xs font-bold">
              {event.team === 'HOME' ? '🏠' : '✈️'}
            </div>
          </div>
        </div>))}
    </div>);
}

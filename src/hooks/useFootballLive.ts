'use client';
import { useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
export interface MatchLiveUpdate {
    matchId: string;
    fixtureId: number;
    status: string;
    elapsed: number | null;
    homeScore: number;
    awayScore: number;
    homeTeam: {
        id: number;
        name: string;
        logo: string;
    };
    awayTeam: {
        id: number;
        name: string;
        logo: string;
    };
    league: string;
    venue: string | null;
    scheduledAt: Date;
    updatedAt: Date;
}
export interface FootballEvent {
    id: string;
    matchId: string;
    fixtureId: number;
    type: string;
    timestamp: Date;
    minute: number;
    team: 'HOME' | 'AWAY';
    player: {
        name: string;
        id?: number;
    };
    detail?: string;
    relatedPlayer?: {
        name: string;
        id?: number;
    };
}
export interface OddsUpdate {
    matchId: string;
    fixtureId: number;
    homeOdds: number;
    drawOdds: number;
    awayOdds: number;
    updatedAt: Date;
}
export interface BettingPoolStats {
    matchId: string;
    fixtureId: number;
    homeBetPool: number;
    drawBetPool: number;
    awayBetPool: number;
    homeBetCount: number;
    drawBetCount: number;
    awayBetCount: number;
    totalPool: number;
    updatedAt: Date;
}
export interface FootballLiveHookCallbacks {
    onMatchUpdate?: (update: MatchLiveUpdate) => void;
    onEvent?: (event: FootballEvent) => void;
    onOddsUpdate?: (odds: OddsUpdate) => void;
    onBettingStats?: (stats: BettingPoolStats) => void;
    onStatusChange?: (change: any) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;
}
let globalSocket: Socket | null = null;
export function useFootballLive(callbacks?: FootballLiveHookCallbacks) {
    const socketRef = useRef<Socket | null>(null);
    const callbacksRef = useRef(callbacks);
    const authToken = useAuthStore.getState().token;
    callbacksRef.current = callbacks;
    useEffect(() => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        if (!socketRef.current) {
            const token = authToken;
            if (!token) {
                callbacksRef.current?.onError?.('Authentication required');
                return;
            }
            const socket = io(wsUrl, {
                auth: { token },
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 10000,
                reconnectionAttempts: 10,
            });
            socketRef.current = socket;
            globalSocket = socket;
            socket.on('connect', () => {
                callbacksRef.current?.onConnect?.();
            });
            socket.on('footballMatchLiveUpdate', (update: MatchLiveUpdate) => {
                callbacksRef.current?.onMatchUpdate?.(update);
            });
            socket.on('footballEvent', (event: FootballEvent) => {
                callbacksRef.current?.onEvent?.(event);
            });
            socket.on('footballOddsUpdate', (odds: OddsUpdate) => {
                callbacksRef.current?.onOddsUpdate?.(odds);
            });
            socket.on('footballBettingStats', (stats: BettingPoolStats) => {
                callbacksRef.current?.onBettingStats?.(stats);
            });
            socket.on('footballMatchStatusChange', (change: any) => {
                callbacksRef.current?.onStatusChange?.(change);
            });
            socket.on('disconnect', () => {
                callbacksRef.current?.onDisconnect?.();
            });
            socket.on('connect_error', (error: any) => {
                callbacksRef.current?.onError?.(error.message);
            });
        }
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                globalSocket = null;
            }
        };
    }, [authToken]);
    const subscribeToMatch = useCallback((matchId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('subscribeToMatch', { matchId });
        }
    }, []);
    const unsubscribeFromMatch = useCallback((matchId: string) => {
        if (socketRef.current) {
            socketRef.current.emit('unsubscribeFromMatch', { matchId });
        }
    }, []);
    const addEvent = useCallback((matchId: string, event: Omit<FootballEvent, 'id' | 'timestamp'>) => {
        if (socketRef.current) {
            socketRef.current.emit('addFootballEvent', { matchId, event });
        }
    }, []);
    return {
        socket: socketRef.current,
        subscribeToMatch,
        unsubscribeFromMatch,
        addEvent,
    };
}
export function getFootballSocket(): Socket | null {
    return globalSocket;
}
export function connectFootballSocket() {
    if (!globalSocket || !globalSocket.connected) {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        const token = useAuthStore.getState().token;
        if (!token) {
            return null;
        }
        globalSocket = io(wsUrl, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });
    }
    return globalSocket;
}
export function disconnectFootballSocket() {
    if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
    }
}

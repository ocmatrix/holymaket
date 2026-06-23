"use client";
import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../../hooks/use-auth';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth-store';
interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}
const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});
export const useSocket = () => useContext(SocketContext);
export function SocketProvider({ children }: {
    children: React.ReactNode;
}) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const socketRef = useRef<Socket | null>(null);
    const authToken = useAuthStore(s => s.token);
    useEffect(() => {
        if (!user?.id) {
            return;
        }
        const token = authToken;
        if (!token) {
            return;
        }
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
        const socketInstance = io(wsUrl, {
            auth: { token },
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            reconnectionAttempts: 10,
        });
        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);
        socketInstance.on('connect', onConnect);
        socketInstance.on('disconnect', onDisconnect);
        socketRef.current = socketInstance;
        setSocket(socketInstance);
        return () => {
            socketInstance.off('connect', onConnect);
            socketInstance.off('disconnect', onDisconnect);
            socketInstance.disconnect();
            setSocket(null);
        };
    }, [user?.id, authToken]);
    useEffect(() => {
        if (socket && user?.id) {
            const userId = user.id;
            const taskUpdateHandler = (data: any) => {
                queryClient.invalidateQueries({ queryKey: ["tasks", userId] });
            };
            const balanceUpdateHandler = (pts: number) => {
                queryClient.setQueryData(["userProfile", userId], (oldData: any) => {
                    if (!oldData)
                        return oldData;
                    return { ...oldData, pts };
                });
                queryClient.invalidateQueries({ queryKey: ["userRecentActivity", userId] });
                queryClient.invalidateQueries({ queryKey: ["battleStats", userId] });
            };
            const betSuccessHandler = (data: any) => {
                queryClient.invalidateQueries({ queryKey: ["markets"] });
                queryClient.invalidateQueries({ queryKey: ["userRecentActivity", userId] });
            };
            const systemBroadcastHandler = (data: any) => {
                if (data.type === 'QUEST_UPDATE') {
                    queryClient.invalidateQueries({ queryKey: ["tasks"] });
                }
            };
            const roundSettledHandler = (data: any) => {
                queryClient.invalidateQueries({ queryKey: ["markets"] });
                queryClient.invalidateQueries({ queryKey: ["userProfile", userId] });
                queryClient.invalidateQueries({ queryKey: ["recentBets"] });
                queryClient.invalidateQueries({ queryKey: ["userRecentActivity", userId] });
            };
            const roundStartHandler = (data: any) => {
                queryClient.invalidateQueries({ queryKey: ["markets"] });
            };
            socket.on('taskUpdate', taskUpdateHandler);
            socket.on('balanceUpdate', balanceUpdateHandler);
            socket.on('betSuccess', betSuccessHandler);
            socket.on('systemBroadcast', systemBroadcastHandler);
            socket.on('roundSettled', roundSettledHandler);
            socket.on('roundStart', roundStartHandler);
            return () => {
                socket.off('taskUpdate', taskUpdateHandler);
                socket.off('balanceUpdate', balanceUpdateHandler);
                socket.off('betSuccess', betSuccessHandler);
                socket.off('systemBroadcast', systemBroadcastHandler);
                socket.off('roundSettled', roundSettledHandler);
                socket.off('roundStart', roundStartHandler);
            };
        }
    }, [socket, user?.id, queryClient]);
    const contextValue = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);
    return (<SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>);
}

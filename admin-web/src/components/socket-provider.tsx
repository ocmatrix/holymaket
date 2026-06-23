"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
}
const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
});
export const useSocket = () => useContext(SocketContext);
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
export function SocketProvider({ children }: {
    children: React.ReactNode;
}) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const queryClient = useQueryClient();
    useEffect(() => {
        console.log('[Admin Socket] Connecting to:', WS_URL);
        const socketInstance = io(WS_URL, {
            withCredentials: true,
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });
        socketInstance.on('connect', () => {
            console.log('✅ Admin WebSocket Connected');
            setIsConnected(true);
        });
        socketInstance.on('disconnect', (reason) => {
            console.log('❌ Admin WebSocket Disconnected:', reason);
            setIsConnected(false);
        });
        socketInstance.on('systemBroadcast', (data) => {
            console.log('📢 Admin Received Broadcast:', data);
            if (data.type === 'QUEST_UPDATE') {
                queryClient.invalidateQueries({ queryKey: ["adminQuestStats"] });
                queryClient.invalidateQueries({ queryKey: ["adminQuests"] });
            }
            if (data.type === 'USER_PROFILE_UPDATE') {
                queryClient.invalidateQueries({ queryKey: ["adminUserAudit"] });
                queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            }
            if (data.type === 'FEATURE_FLAG_UPDATE') {
                queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
            }
        });
        socketInstance.on('newBet', (data) => {
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
            queryClient.invalidateQueries({ queryKey: ["adminLogs"] });
        });
        socketInstance.on('admin:newTransaction', () => {
            queryClient.invalidateQueries({ queryKey: ["adminRecentTransactions"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardStats"] });
        });
        setSocket(socketInstance);
        return () => {
            socketInstance.disconnect();
        };
    }, [queryClient]);
    return (<SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>);
}

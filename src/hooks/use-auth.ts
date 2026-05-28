"use client";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useLanguageStore } from "@/stores/language-store";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api";
import axios from "axios";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
function subscribeTokenRefresh(cb: (token: string) => void) {
    refreshSubscribers.push(cb);
}
function onTokenRefreshed(token: string) {
    refreshSubscribers.forEach(cb => cb(token));
    refreshSubscribers = [];
}
axios.interceptors.response.use((response) => response, async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 &&
        !originalRequest._retry &&
        originalRequest.url &&
        !originalRequest.url.includes('/auth/')) {
        originalRequest._retry = true;
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken)
            return Promise.reject(error);
        if (!isRefreshing) {
            isRefreshing = true;
            try {
                const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
                localStorage.setItem('auth_token', data.accessToken);
                if (data.refreshToken)
                    localStorage.setItem('refresh_token', data.refreshToken);
                onTokenRefreshed(data.accessToken);
                isRefreshing = false;
                originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
                return axios(originalRequest);
            }
            catch {
                isRefreshing = false;
                refreshSubscribers = [];
                localStorage.removeItem('auth_token');
                localStorage.removeItem('refresh_token');
                return Promise.reject(error);
            }
        }
        else {
            return new Promise((resolve) => {
                subscribeTokenRefresh((newToken: string) => {
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                    resolve(axios(originalRequest));
                });
            });
        }
    }
    return Promise.reject(error);
});
export function useAuth() {
    const { ready, authenticated, user: privyUser, login: privyLogin, logout: privyLogout, linkWallet: privyLinkWallet, linkTwitter: privyLinkTwitter, linkDiscord: privyLinkDiscord, linkEmail: privyLinkEmail } = usePrivy();
    const { wallets } = useWallets();
    const dbUser = useAuthStore(s => s.user);
    const setStatus = useAuthStore(s => s.setStatus);
    const setUser = useAuthStore(s => s.setUser);
    const setToken = useAuthStore(s => s.setToken);
    const status = useAuthStore(s => s.status);
    const storeLogout = useAuthStore(s => s.logout);
    const t = useLanguageStore(s => s.t);
    const showNotification = useUIStore(s => s.showNotification);
    const syncingRef = useRef(false);
    const syncUserToBackend = useCallback(async (isReconnect = false) => {
        if (!privyUser || syncingRef.current)
            return;
        try {
            syncingRef.current = true;
            if (!isReconnect)
                setStatus('loading');
            const address = privyUser.wallet?.address || null;
            const email = privyUser.email?.address || privyUser.google?.email || null;
            const twitterId = privyUser.twitter?.username || null;
            const discordId = privyUser.discord?.username || null;
            const referrerCode = localStorage.getItem('referrerCode');
            const { data } = await axios.post(`${API_BASE}/auth/verify-privy`, {
                privyId: privyUser.id,
                address,
                email,
                twitterId,
                discordId,
                referrerCode
            });
            if (data.accessToken || data.token) {
                const accessToken = data.accessToken || data.token;
                localStorage.setItem('auth_token', accessToken);
                setToken(accessToken);
            }
            if (data.refreshToken) {
                localStorage.setItem('refresh_token', data.refreshToken);
            }
            setUser(data.user);
            setStatus('authenticated');
            if (data.isNewUser && t?.welcome?.newUser) {
                showNotification(t.welcome.newUser, 'SUCCESS');
                localStorage.removeItem('referrerCode');
            }
        }
        catch (error) {
            console.error('Failed to sync user with backend:', error);
            setStatus('unauthenticated');
        }
        finally {
            syncingRef.current = false;
        }
    }, [privyUser, setUser, setToken, setStatus, showNotification, t]);
    useEffect(() => {
        const savedToken = localStorage.getItem('auth_token');
        if (savedToken) {
            setToken(savedToken);
        }
    }, [setToken]);
    useEffect(() => {
        if (ready && authenticated && privyUser && !dbUser && !syncingRef.current) {
            syncUserToBackend();
        }
        else if (ready && !authenticated) {
            setStatus('unauthenticated');
        }
    }, [ready, authenticated, privyUser, dbUser, syncUserToBackend, setStatus]);
    const linkedAccountsKey = privyUser?.linkedAccounts?.map(a => a.type + (a as any).address + (a as any).username).join(',');
    useEffect(() => {
        if (ready && authenticated && privyUser && dbUser && !syncingRef.current) {
            const currentAddress = privyUser.wallet?.address;
            const currentEmail = privyUser.email?.address || privyUser.google?.email;
            const currentTwitter = privyUser.twitter?.username;
            const currentDiscord = privyUser.discord?.username;
            const needsSync = (currentAddress && currentAddress !== dbUser.address) ||
                (currentEmail && currentEmail !== dbUser.email) ||
                (currentTwitter && currentTwitter !== dbUser.twitterId) ||
                (currentDiscord && currentDiscord !== dbUser.discordId);
            if (needsSync) {
                syncUserToBackend(true);
            }
        }
    }, [linkedAccountsKey, ready, authenticated, privyUser, dbUser, syncUserToBackend]);
    const login = () => {
        setStatus('loading');
        privyLogin();
    };
    const logout = () => {
        storeLogout();
        privyLogout();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
    };
    const user = dbUser ? {
        ...dbUser,
        username: dbUser.username || privyUser?.twitter?.username || privyUser?.discord?.username || "Explorer"
    } : null;
    return {
        user,
        status,
        login,
        logout,
        linkWallet: privyLinkWallet,
        linkTwitter: privyLinkTwitter,
        linkDiscord: privyLinkDiscord,
        linkEmail: privyLinkEmail,
        isConnected: authenticated,
        address: user?.address || privyUser?.wallet?.address
    };
}

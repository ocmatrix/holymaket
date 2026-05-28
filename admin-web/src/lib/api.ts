import axios from "axios";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const LEGACY_ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || "";
export const adminApi = axios.create({
    baseURL: BACKEND_URL,
    headers: {
        "Content-Type": "application/json",
        ...(LEGACY_ADMIN_TOKEN ? { "x-admin-token": LEGACY_ADMIN_TOKEN } : {}),
    },
    withCredentials: true,
});
adminApi.interceptors.response.use((response) => response.data, (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (currentPath !== "/login") {
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
    }
    console.error("Admin API Error:", error.response?.data || error.message);
    return Promise.reject(error);
});
export const api = {
    getStats: () => adminApi.get("/super-admin-api/dashboard-stats"),
    getLogs: () => adminApi.get("/super-admin-api/operation-logs"),
    getOnlineUsers: () => adminApi.get("/super-admin-api/system/online-users"),
    broadcastMessage: (data: {
        type: string;
        message: string;
    }) => adminApi.post("/super-admin-api/system/broadcast", data),
    getAgentConfigs: () => adminApi.get("/super-admin-api/agents/configs"),
    updateAgent: (id: string, data: {
        winRate?: number;
        difficultyBias?: number;
        aggressiveness?: number;
        trapFrequency?: number;
        isActive?: boolean;
        personality?: string;
    }) => adminApi.post(`/super-admin-api/agent/tune/${id}`, data),
    getUsers: () => adminApi.get("/super-admin-api/users"),
    getUserAudit: (id: string) => adminApi.get(`/super-admin-api/user-audit/${id}`),
    updateUserPts: (data: {
        userId: string;
        amount: number;
        reason: string;
    }) => adminApi.post("/super-admin-api/user/update-pts", data),
    resetUserCombo: (userId: string) => adminApi.post("/super-admin-api/user/reset-combo", { userId }),
    deleteUser: (id: string) => adminApi.delete(`/super-admin-api/user/${id}`),
    createMarket: (data: any) => adminApi.post("/super-admin-api/market/create", data),
    resolveMarket: (id: string) => adminApi.post(`/super-admin-api/market/resolve/${id}`),
    getQuests: () => adminApi.get("/super-admin-api/quest-list"),
    getQuestStats: () => adminApi.get("/super-admin-api/quest-stats"),
    createQuest: (data: any) => adminApi.post("/super-admin-api/quest/deploy", data),
    updateQuest: (data: any) => adminApi.post("/super-admin-api/quest/update", data),
    deleteQuest: (id: string) => adminApi.post("/super-admin-api/quest/delete", { id }),
    resetDailyQuests: () => adminApi.post("/super-admin-api/quest/reset-daily"),
    getRecentTransactions: (limit?: number) => adminApi.get("/super-admin-api/transactions/recent", {
        params: limit != null ? { limit } : undefined,
    }),
    getFeatureFlags: () => adminApi.get("/super-admin-api/system/feature-flags"),
    getFeatureFlag: (feature: string) => adminApi.get(`/super-admin-api/system/feature-flags/${feature}`),
    updateFeatureFlag: (feature: string, enabled: boolean) => adminApi.post(`/super-admin-api/system/feature-flags/${feature}`, { enabled }),
    updateFeatureFlags: (flags: Record<string, boolean>) => adminApi.post("/super-admin-api/system/feature-flags", { flags }),
    getAllNotifications: (page = 1, limit = 20) => adminApi.get("/notification/admin/all", { params: { page, limit } }),
    sendNotification: (data: {
        userId?: string;
        type: string;
        title: string;
        message: string;
        metadata?: any;
    }) => adminApi.post("/notification/admin/send", data),
    sendBulkNotification: (data: {
        userIds: string[];
        type: string;
        title: string;
        message: string;
    }) => adminApi.post("/notification/admin/send-bulk", data),
    sendGlobalNotification: (data: {
        type: string;
        title: string;
        message: string;
    }) => adminApi.post("/notification/admin/send-global", data),
    deleteNotification: (id: string) => adminApi.delete(`/notification/admin/${id}`),
    getSeasons: () => adminApi.get("/season/list"),
    getActiveSeason: () => adminApi.get("/season/active"),
    createSeason: (data: {
        name: string;
        startDate: string;
        endDate: string;
        description?: string;
        rewards?: any;
    }) => adminApi.post("/season/admin/create", data),
    updateSeason: (id: string, data: any) => adminApi.put(`/season/admin/${id}`, data),
    deleteSeason: (id: string) => adminApi.delete(`/season/admin/${id}`),
    endSeason: (id: string) => adminApi.post(`/season/admin/${id}/end`),
    getTournaments: () => adminApi.get("/season/tournaments"),
    createTournament: (data: {
        name: string;
        startDate: string;
        endDate: string;
        entryFee?: number;
        prizePool?: number;
        maxParticipants?: number;
        description?: string;
    }) => adminApi.post("/season/admin/tournament/create", data),
    updateTournament: (id: string, data: any) => adminApi.put(`/season/admin/tournament/${id}`, data),
    deleteTournament: (id: string) => adminApi.delete(`/season/admin/tournament/${id}`),
    endTournament: (id: string) => adminApi.post(`/season/admin/tournament/${id}/end`),
    getTournamentParticipants: (id: string) => adminApi.get(`/season/tournaments/${id}/leaderboard`),
    getReferralStats: () => adminApi.get("/referral/admin/stats"),
    getTopReferrers: (limit = 20) => adminApi.get("/referral/admin/top", { params: { limit } }),
    getRoundConfig: () => adminApi.get("/super-admin-api/system/round-config"),
    updateRoundConfig: (data: any) => adminApi.post("/super-admin-api/system/round-config", data),
    getComboConfig: () => adminApi.get("/super-admin-api/system/combo-config"),
    updateComboConfig: (data: any) => adminApi.post("/super-admin-api/system/combo-config", data),
    getAiConfig: () => adminApi.get("/super-admin-api/system/ai-config"),
    updateAiConfig: (data: {
        provider?: string;
        deepseekApiKey?: string;
        deepseekModel?: string;
        openaiApiKey?: string;
        openaiModel?: string;
    }) => adminApi.post("/super-admin-api/system/ai-config", data),
    getRpcNodes: () => adminApi.get("/super-admin-api/system/rpc-nodes"),
    updateRpcNodes: (nodes: any[]) => adminApi.post("/super-admin-api/system/rpc-nodes", { nodes }),
    addRpcNode: (node: {
        url: string;
        name: string;
        priority: number;
        enabled: boolean;
    }) => adminApi.post("/super-admin-api/system/rpc-nodes/add", node),
    deleteRpcNode: (url: string) => adminApi.post("/super-admin-api/system/rpc-nodes/delete", { url }),
    testRpcNode: (url: string) => adminApi.post("/super-admin-api/system/rpc-nodes/test", { url }),
    refreshRpcNodes: () => adminApi.post("/super-admin-api/system/rpc-nodes/refresh"),
};

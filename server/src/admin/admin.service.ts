import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ethers } from 'ethers';
interface RpcNode {
    url: string;
    name: string;
    priority: number;
    enabled: boolean;
}
const DEFAULT_RPC_NODES: RpcNode[] = [
    { url: 'https://rpc.ankr.com/eth', name: 'Ankr', priority: 100, enabled: true },
    { url: 'https://cloudflare-eth.com', name: 'Cloudflare', priority: 90, enabled: true },
    { url: 'https://ethereum.publicnode.com', name: 'PublicNode', priority: 80, enabled: true },
    { url: 'https://eth.llamarpc.com', name: 'LlamaRPC', priority: 70, enabled: true },
    { url: 'https://1rpc.io/eth', name: '1RPC', priority: 60, enabled: true },
];
@Injectable()
export class AdminService {
    private readonly logger = new Logger(AdminService.name);
    constructor(private prisma: PrismaService) { }
    async getDashboardStats() {
        const totalPtsIssued = await this.prisma.user.aggregate({
            _sum: { pts: true }
        });
        const totalBets = await this.prisma.bet.count();
        const totalWagered = await this.prisma.bet.aggregate({
            _sum: { amount: true }
        });
        const agents = await this.prisma.agent.findMany({
            include: {
                battles: {
                    take: 100,
                    orderBy: { timestamp: 'desc' }
                }
            }
        });
        const agentStats = agents.map(agent => {
            const recentBattles = agent.battles;
            const winRate = recentBattles.length > 0
                ? (recentBattles.filter(b => b.winner === 'AGENT').length / recentBattles.length) * 100
                : 0;
            return {
                id: agent.id,
                name: agent.name,
                level: agent.level,
                realtimeWinRate: winRate.toFixed(1),
                totalBattles: agent.battles.length
            };
        });
        const activeMarkets = await this.prisma.market.findMany({
            where: { status: 'ACTIVE' },
            include: {
                _count: { select: { bets: true } }
            }
        });
        return {
            economy: {
                totalPtsSupply: totalPtsIssued._sum.pts || 0,
                totalBets,
                totalWagered: totalWagered._sum.amount || 0,
                platformProfit: (totalWagered._sum.amount || 0) - (totalPtsIssued._sum.pts || 0),
            },
            agents: agentStats,
            markets: activeMarkets.map(m => ({
                id: m.id,
                title: m.title,
                category: m.category,
                timeframe: m.timeframe,
                poolSize: m.poolSize,
                betCount: m._count.bets
            }))
        };
    }
    async getQuestStats() {
        const totalQuests = await this.prisma.task.count();
        const totalClaims = await this.prisma.userTask.count({
            where: { status: 'CLAIMED' }
        });
        const totalUserTasks = await this.prisma.userTask.count();
        const totalPtsDistributed = await this.prisma.userTask.findMany({
            where: { status: 'CLAIMED' },
            include: { task: true }
        });
        const ptsSum = totalPtsDistributed.reduce((acc, ut) => acc + ut.task.reward, 0);
        const conversionRate = totalUserTasks > 0
            ? (Number(((totalClaims / totalUserTasks) * 100).toFixed(1)))
            : 0;
        return {
            totalQuests,
            totalClaims,
            totalPtsDistributed: ptsSum,
            conversionRate
        };
    }
    async getGlobalLogs() {
        const recentBets = await this.prisma.bet.findMany({
            take: 20,
            orderBy: { timestamp: 'desc' },
            include: {
                user: { select: { username: true, address: true } },
                market: { select: { title: true } }
            }
        });
        const recentBattles = await this.prisma.battle.findMany({
            take: 20,
            orderBy: { timestamp: 'desc' },
            include: {
                user: { select: { username: true } },
                agent: { select: { name: true, level: true } }
            }
        });
        return {
            bets: recentBets,
            battles: recentBattles
        };
    }
    async getUserAudit(identifier: string) {
        return this.prisma.user.findFirst({
            where: {
                OR: [
                    { id: identifier },
                    { address: identifier }
                ]
            },
            include: {
                battles: { take: 10, orderBy: { timestamp: 'desc' } },
                bets: { take: 10, orderBy: { timestamp: 'desc' } },
            }
        });
    }
    async deleteUser(userId: string) {
        this.logger.warn(`🛑 [ADMIN_ACTION] DELETING USER ${userId} PERMANENTLY`);
        return this.prisma.$transaction(async (tx) => {
            await tx.userTask.deleteMany({ where: { userId } });
            await tx.battle.deleteMany({ where: { userId } });
            await tx.bet.deleteMany({ where: { userId } });
            await tx.transaction.deleteMany({ where: { userId } });
            await tx.seasonRanking.deleteMany({ where: { userId } });
            await tx.tournamentParticipant.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.referralReward.deleteMany({
                where: { OR: [{ referrerId: userId }, { refereeId: userId }] }
            });
            await tx.user.updateMany({
                where: { referrerId: userId },
                data: { referrerId: null }
            });
            return tx.user.delete({ where: { id: userId } });
        });
    }
    async updateUserPts(userId: string, amount: number, reason: string) {
        this.logger.log(`⚠️ [ADMIN_ACTION] User ${userId} PTS adjusted by ${amount}. Reason: ${reason}`);
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                pts: { increment: amount },
                version: { increment: 1 }
            }
        });
    }
    async resetUserCombo(userId: string) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                combo: 0,
                multiplier: 1.0,
                version: { increment: 1 }
            }
        });
    }
    async updateAgentConfig(agentId: string, data: {
        winRate?: number;
        difficultyBias?: number;
        aggressiveness?: number;
        trapFrequency?: number;
        isActive?: boolean;
        personality?: string;
    }) {
        return this.prisma.agent.update({
            where: { id: agentId },
            data: {
                winRate: data.winRate,
                difficultyBias: data.difficultyBias,
                aggressiveness: data.aggressiveness,
                trapFrequency: data.trapFrequency,
                isActive: data.isActive,
                personality: data.personality
            }
        });
    }
    async getAgentConfigs() {
        const agents = await this.prisma.agent.findMany({
            include: {
                _count: { select: { battles: true } }
            }
        });
        const agentsWithStats = await Promise.all(agents.map(async (agent) => {
            const battles = await this.prisma.battle.findMany({
                where: { agentId: agent.id },
                select: { winner: true }
            });
            const totalBattles = battles.length;
            const agentWins = battles.filter(b => b.winner === 'AGENT').length;
            const actualWinRate = totalBattles > 0 ? (agentWins / totalBattles) * 100 : 0;
            return {
                ...agent,
                totalBattles,
                actualWinRate: actualWinRate.toFixed(1)
            };
        }));
        return agentsWithStats;
    }
    async createQuest(data: {
        id: string;
        title: string;
        description: string;
        reward: number;
        type: string;
        goal: number;
        isDaily?: boolean;
    }) {
        return this.prisma.task.upsert({
            where: { id: data.id },
            create: {
                id: data.id,
                title: data.title,
                description: data.description || "",
                reward: data.reward,
                type: data.type,
                goal: data.goal,
                isDaily: data.isDaily || false
            },
            update: {
                title: data.title,
                description: data.description || "",
                reward: data.reward,
                type: data.type,
                goal: data.goal,
                isDaily: data.isDaily || false
            }
        });
    }
    async deleteQuest(questId: string) {
        return this.prisma.task.delete({ where: { id: questId } });
    }
    async updateQuest(id: string, data: {
        title?: string;
        description?: string;
        reward?: number;
        type?: string;
        goal?: number;
        isDaily?: boolean;
    }) {
        const { id: _, ...updateData } = data as any;
        return this.prisma.task.update({
            where: { id },
            data: updateData
        });
    }
    async createMarket(category: string, timeframe: string, title: string, durationMinutes: number) {
        const now = new Date();
        const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
        return this.prisma.market.create({
            data: {
                category,
                timeframe,
                title,
                status: 'ACTIVE',
                endTime,
                resolutionTime: new Date(endTime.getTime() + 2000),
                poolSize: 0
            }
        });
    }
    async resolveMarketManually(marketId: string) {
    }
    async getGlobalVaultHistory(limit: number = 50) {
        return this.prisma.transaction.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { username: true, address: true } } }
        });
    }
    async getUsersByIds(ids: string[]) {
        return this.prisma.user.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                username: true,
                pts: true,
                address: true,
                combo: true,
                multiplier: true
            }
        });
    }
    async getAllUsers() {
        return this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                pts: true,
                address: true,
                combo: true,
                multiplier: true,
                createdAt: true,
                version: true
            }
        });
    }
    async getRpcNodes(): Promise<{
        nodes: RpcNode[];
        lastUpdated: Date | null;
    }> {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key: 'rpc_nodes' }
        });
        if (!config) {
            return { nodes: DEFAULT_RPC_NODES, lastUpdated: null };
        }
        try {
            const nodes = JSON.parse(config.value) as RpcNode[];
            return { nodes, lastUpdated: config.updatedAt };
        }
        catch (e) {
            this.logger.error('Failed to parse RPC nodes config');
            return { nodes: DEFAULT_RPC_NODES, lastUpdated: null };
        }
    }
    async updateRpcNodes(nodes: RpcNode[]) {
        const sortedNodes = nodes.sort((a, b) => b.priority - a.priority);
        const config = await this.prisma.systemConfig.upsert({
            where: { key: 'rpc_nodes' },
            create: {
                key: 'rpc_nodes',
                value: JSON.stringify(sortedNodes)
            },
            update: {
                value: JSON.stringify(sortedNodes)
            }
        });
        this.logger.log(`RPC nodes updated: ${nodes.length} nodes configured`);
        return { success: true, nodes: sortedNodes, updatedAt: config.updatedAt };
    }
    async addRpcNode(data: {
        url: string;
        name: string;
        priority?: number;
    }) {
        const { nodes } = await this.getRpcNodes();
        if (nodes.some(n => n.url === data.url)) {
            return { success: false, error: 'RPC node already exists' };
        }
        const newNode: RpcNode = {
            url: data.url,
            name: data.name,
            priority: data.priority ?? 50,
            enabled: true
        };
        nodes.push(newNode);
        return this.updateRpcNodes(nodes);
    }
    async deleteRpcNode(url: string) {
        const { nodes } = await this.getRpcNodes();
        const filteredNodes = nodes.filter(n => n.url !== url);
        if (filteredNodes.length === nodes.length) {
            return { success: false, error: 'RPC node not found' };
        }
        return this.updateRpcNodes(filteredNodes);
    }
    async testRpcNode(url: string): Promise<{
        success: boolean;
        latency?: number;
        blockNumber?: number;
        error?: string;
    }> {
        try {
            const startTime = Date.now();
            const provider = new ethers.JsonRpcProvider(url, 1, { staticNetwork: true });
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), 10000);
            });
            const blockPromise = provider.getBlockNumber();
            const blockNumber = await Promise.race([blockPromise, timeoutPromise]) as number;
            const latency = Date.now() - startTime;
            this.logger.log(`RPC test successful: ${url} - Block: ${blockNumber}, Latency: ${latency}ms`);
            return { success: true, latency, blockNumber };
        }
        catch (error: any) {
            this.logger.error(`RPC test failed: ${url} - ${error.message}`);
            return { success: false, error: error.message };
        }
    }
    async getActiveRpcUrls(): Promise<string[]> {
        const { nodes } = await this.getRpcNodes();
        return nodes
            .filter(n => n.enabled)
            .sort((a, b) => b.priority - a.priority)
            .map(n => n.url);
    }
    async getAiConfig(): Promise<{
        provider: string;
        deepseekApiKey?: string;
        deepseekModel?: string;
        openaiApiKey?: string;
        openaiModel?: string;
    }> {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key: 'ai_config' }
        });
        if (!config) {
            return {
                provider: 'deepseek',
                deepseekModel: 'deepseek-chat',
                openaiModel: 'gpt-4o-mini',
            };
        }
        try {
            const parsed = JSON.parse(config.value);
            return {
                provider: parsed.provider ?? 'deepseek',
                deepseekApiKey: parsed.deepseekApiKey ?? undefined,
                deepseekModel: parsed.deepseekModel ?? 'deepseek-chat',
                openaiApiKey: parsed.openaiApiKey ?? undefined,
                openaiModel: parsed.openaiModel ?? 'gpt-4o-mini',
            };
        }
        catch (e) {
            this.logger.error('Failed to parse ai_config');
            return { provider: 'deepseek', deepseekModel: 'deepseek-chat', openaiModel: 'gpt-4o-mini' };
        }
    }
    async updateAiConfig(data: {
        provider?: string;
        deepseekApiKey?: string;
        deepseekModel?: string;
        openaiApiKey?: string;
        openaiModel?: string;
    }) {
        const current = await this.getAiConfig();
        const merged = {
            ...current,
            ...(data.provider != null && { provider: data.provider }),
            ...(data.deepseekApiKey !== undefined && { deepseekApiKey: data.deepseekApiKey }),
            ...(data.deepseekModel !== undefined && { deepseekModel: data.deepseekModel }),
            ...(data.openaiApiKey !== undefined && { openaiApiKey: data.openaiApiKey }),
            ...(data.openaiModel !== undefined && { openaiModel: data.openaiModel }),
        };
        await this.prisma.systemConfig.upsert({
            where: { key: 'ai_config' },
            create: { key: 'ai_config', value: JSON.stringify(merged) },
            update: { value: JSON.stringify(merged) },
        });
        this.logger.log('AI config updated via admin');
        return merged;
    }
    private readonly DEFAULT_FEATURE_FLAGS = {
        playground: true,
        market: true,
        wallet: true,
        referral: true,
        tournaments: true,
        leaderboard: true,
    };
    private readonly DEFAULT_COMBO_CONFIG = {
        MULTIPLIER_INCREMENT: 0.1,
        MAX_MULTIPLIER: 3.0,
        BASE_MULTIPLIER: 1.0,
        MAX_COMBO_COUNT: 3,
        RESET_MULTIPLIER: 1.0,
        RESET_COMBO: 0,
    };
    async getFeatureFlags(): Promise<Record<string, boolean>> {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key: 'feature_flags' }
        });
        if (!config) {
            return this.DEFAULT_FEATURE_FLAGS;
        }
        try {
            const flags = JSON.parse(config.value);
            return { ...this.DEFAULT_FEATURE_FLAGS, ...flags };
        }
        catch (e) {
            this.logger.error('Failed to parse feature flags');
            return this.DEFAULT_FEATURE_FLAGS;
        }
    }
    async getFeatureFlag(feature: string): Promise<boolean> {
        const flags = await this.getFeatureFlags();
        return flags[feature] ?? true;
    }
    async updateFeatureFlag(feature: string, enabled: boolean) {
        const currentFlags = await this.getFeatureFlags();
        currentFlags[feature] = enabled;
        const config = await this.prisma.systemConfig.upsert({
            where: { key: 'feature_flags' },
            create: {
                key: 'feature_flags',
                value: JSON.stringify(currentFlags)
            },
            update: {
                value: JSON.stringify(currentFlags)
            }
        });
        this.logger.log(`Feature flag updated: ${feature} = ${enabled}`);
        return { success: true, feature, enabled, updatedAt: config.updatedAt };
    }
    async updateFeatureFlags(flags: Record<string, boolean>) {
        const currentFlags = await this.getFeatureFlags();
        const updatedFlags = { ...currentFlags, ...flags };
        const config = await this.prisma.systemConfig.upsert({
            where: { key: 'feature_flags' },
            create: {
                key: 'feature_flags',
                value: JSON.stringify(updatedFlags)
            },
            update: {
                value: JSON.stringify(updatedFlags)
            }
        });
        this.logger.log(`Feature flags updated: ${JSON.stringify(flags)}`);
        return { success: true, flags: updatedFlags, updatedAt: config.updatedAt };
    }
    async getRoundConfig() {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key: 'round_config' }
        });
        if (!config) {
            return {
                ROUND_DURATION: 60,
                BETTING_WINDOW: 55,
                LOCK_PERIOD: 5,
                MIN_BET: 10,
                MAX_BET: 1000,
                PAYOUT_RATIO: 1.95,
            };
        }
        return JSON.parse(config.value);
    }
    async updateRoundConfig(data: any) {
        const config = await this.prisma.systemConfig.upsert({
            where: { key: 'round_config' },
            create: {
                key: 'round_config',
                value: JSON.stringify(data)
            },
            update: {
                value: JSON.stringify(data)
            }
        });
        this.logger.log('Round config updated by admin');
        return { success: true, config: data, updatedAt: config.updatedAt };
    }
    async getComboConfig() {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key: 'combo_config' }
        });
        if (!config) {
            return this.DEFAULT_COMBO_CONFIG;
        }
        return { ...this.DEFAULT_COMBO_CONFIG, ...JSON.parse(config.value) };
    }
    async updateComboConfig(data: any) {
        const config = await this.prisma.systemConfig.upsert({
            where: { key: 'combo_config' },
            create: {
                key: 'combo_config',
                value: JSON.stringify(data)
            },
            update: {
                value: JSON.stringify(data)
            }
        });
        this.logger.log('Combo config updated by admin');
        return { success: true, config: data, updatedAt: config.updatedAt };
    }
}

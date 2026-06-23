import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '../auth/jwt.service';
import * as jwt from 'jsonwebtoken';

const socketCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

@WebSocketGateway({
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? socketCorsOrigins
            : (socketCorsOrigins.length > 0 ? socketCorsOrigins : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004', 'http://localhost:3005']),
        credentials: true,
    },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private logger: Logger = new Logger('EventsGateway');
    private readonly jwtService = new JwtService();
    private onlineUsers: Map<string, string> = new Map();
    handleConnection(client: Socket) {
        const token = this.getHandshakeToken(client);
        if (!token) {
            const admin = this.verifyAdminCookie(client);
            if (admin) {
                client.data.admin = admin;
                this.logger.log(`Admin connected: ${admin.adminId} (Socket: ${client.id})`);
                return;
            }
            this.logger.warn(`Socket rejected without token: ${client.id}`);
            client.disconnect(true);
            return;
        }
        try {
            const payload = this.jwtService.verifyAccessToken(token);
            client.data.user = payload;
            this.onlineUsers.set(payload.sub, client.id);
            client.join(payload.sub);
            this.logger.log(`User connected: ${payload.sub} (Socket: ${client.id})`);
        }
        catch {
            this.logger.warn(`Socket rejected with invalid token: ${client.id}`);
            client.disconnect(true);
        }
    }
    private getHandshakeToken(client: Socket): string | null {
        const authToken = client.handshake.auth?.token;
        if (typeof authToken === 'string' && authToken) {
            return authToken;
        }
        const queryToken = client.handshake.query.token;
        if (typeof queryToken === 'string' && queryToken) {
            return queryToken;
        }
        const header = client.handshake.headers.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer ')) {
            return header.slice(7);
        }
        return null;
    }
    private verifyAdminCookie(client: Socket): any | null {
        const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
        const cookieHeader = client.handshake.headers.cookie;
        if (!secret || typeof cookieHeader !== 'string') {
            return null;
        }
        const adminToken = cookieHeader
            .split(';')
            .map(part => part.trim())
            .find(part => part.startsWith('admin-session='))
            ?.slice('admin-session='.length);
        if (!adminToken) {
            return null;
        }
        try {
            const payload = jwt.verify(decodeURIComponent(adminToken), secret) as any;
            return payload?.adminId ? payload : null;
        }
        catch {
            return null;
        }
    }
    handleDisconnect(client: Socket) {
        for (const [userId, socketId] of this.onlineUsers.entries()) {
            if (socketId === client.id) {
                this.onlineUsers.delete(userId);
                this.logger.log(`User disconnected: ${userId}`);
                break;
            }
        }
    }
    @SubscribeMessage('authenticate')
    handleAuthenticate(client: Socket, data: {
        token?: string;
    }) {
        if (!data?.token)
            return;
        try {
            const payload = this.jwtService.verifyAccessToken(data.token);
            for (const [uid, sid] of this.onlineUsers.entries()) {
                if (sid === client.id) {
                    this.onlineUsers.delete(uid);
                    break;
                }
            }
            client.data.user = payload;
            this.onlineUsers.set(payload.sub, client.id);
            client.join(payload.sub);
            this.logger.log(`User authenticated: ${payload.sub} (Socket: ${client.id})`);
        }
        catch {
            this.logger.warn(`Socket authenticate rejected: ${client.id}`);
        }
    }
    getOnlineUserIds(): string[] {
        return Array.from(this.onlineUsers.keys()).filter(id => id !== 'guest');
    }
    emitTaskUpdate(userId: string, task: any) {
        this.server.to(userId).emit('taskUpdate', task);
    }
    emitBetSuccess(userId: string, bet: any) {
        this.server.to(userId).emit('betSuccess', bet);
    }
    emitBattleResult(userId: string, battle: any) {
        this.server.to(userId).emit('battleResult', battle);
    }
    emitBalanceUpdate(userId: string, pts: number) {
        this.server.to(userId).emit('balanceUpdate', pts);
    }
    broadcastSystemMessage(type: string, message: string) {
        this.server.emit('systemBroadcast', { type, message, timestamp: new Date() });
    }
    emitRoundUpdate(roundData: {
        category: string;
        roundNumber: number;
        status: string;
        openPrice?: number;
        closePrice?: number;
        highPrice?: number;
        lowPrice?: number;
        result?: string;
        longPool: number;
        shortPool: number;
        longBetCount: number;
        shortBetCount: number;
        startTime: Date;
        endTime: Date;
        lockTime: Date;
    }) {
        this.server.emit('roundUpdate', roundData);
        this.logger.debug(`Round update broadcast: #${roundData.roundNumber} [${roundData.status}]`);
    }
    emitNewBet(betData: {
        category: string;
        roundNumber: number;
        address: string;
        position: string;
        amount: number;
        timestamp: Date;
    }) {
        this.server.emit('newBet', betData);
    }
    emitCountdown(category: string, countdown: number, status: string) {
        this.server.emit('roundCountdown', { category, countdown, status });
    }
    emitUserProfileUpdate(userId: string, data: any) {
        this.server.to(userId).emit('userProfileUpdate', {
            data,
            timestamp: new Date()
        });
    }
    emitBetResult(userId: string, result: {
        roundNumber: number;
        position: string;
        amount: number;
        result: string;
        payout: number;
        newCombo: number;
        newMultiplier: number;
    }) {
        this.server.to(userId).emit('betResult', result);
    }
    emitMatchLiveUpdate(liveUpdate: {
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
    }) {
        this.server.emit('footballMatchLiveUpdate', liveUpdate);
        this.logger.debug(`Football match live update: ${liveUpdate.homeTeam.name} ${liveUpdate.homeScore}-${liveUpdate.awayScore} ${liveUpdate.awayTeam.name} [${liveUpdate.elapsed}']`);
    }
    emitFootballEvent(event: {
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
    }) {
        this.server.emit('footballEvent', event);
        this.logger.debug(`Football event: [${event.type}] ${event.player.name} (${event.minute}') at ${event.matchId}`);
    }
    emitOddsUpdate(oddsUpdate: {
        matchId: string;
        fixtureId: number;
        homeOdds: number;
        drawOdds: number;
        awayOdds: number;
        updatedAt: Date;
    }) {
        this.server.emit('footballOddsUpdate', oddsUpdate);
    }
    emitBettingStatsUpdate(stats: {
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
    }) {
        this.server.emit('footballBettingStats', stats);
    }
    emitMatchStatusChange(statusChange: {
        matchId: string;
        fixtureId: number;
        newStatus: string;
        previousStatus: string;
        timestamp: Date;
    }) {
        this.server.emit('footballMatchStatusChange', statusChange);
        this.logger.log(`Football match status change: ${statusChange.previousStatus} -> ${statusChange.newStatus} (${statusChange.matchId})`);
    }
}

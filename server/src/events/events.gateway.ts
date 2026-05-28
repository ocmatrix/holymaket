import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private logger: Logger = new Logger('EventsGateway');
    private onlineUsers: Map<string, string> = new Map();
    handleConnection(client: Socket) {
        const userId = client.handshake.query.userId as string;
        if (userId && userId !== 'guest') {
            this.onlineUsers.set(userId, client.id);
            client.join(userId);
            this.logger.log(`User connected: ${userId} (Socket: ${client.id})`);
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
        userId: string;
    }) {
        if (!data?.userId)
            return;
        for (const [uid, sid] of this.onlineUsers.entries()) {
            if (sid === client.id) {
                this.onlineUsers.delete(uid);
                break;
            }
        }
        this.onlineUsers.set(data.userId, client.id);
        client.join(data.userId);
        this.logger.log(`User authenticated: ${data.userId} (Socket: ${client.id})`);
    }
    getOnlineUserIds(): string[] {
        return Array.from(this.onlineUsers.keys()).filter(id => id !== 'guest');
    }
    emitTaskUpdate(userId: string, task: any) {
        this.server.emit(`taskUpdate:${userId}`, task);
    }
    emitBetSuccess(userId: string, bet: any) {
        this.server.emit(`betSuccess:${userId}`, bet);
    }
    emitBattleResult(userId: string, battle: any) {
        this.server.emit(`battleResult:${userId}`, battle);
    }
    emitBalanceUpdate(userId: string, pts: number) {
        this.server.emit(`balanceUpdate:${userId}`, pts);
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
        this.server.emit('systemBroadcast', {
            type: 'USER_PROFILE_UPDATE',
            userId,
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
        this.server.emit(`betResult:${userId}`, result);
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

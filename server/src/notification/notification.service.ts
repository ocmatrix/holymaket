import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EventsGateway } from '../events/events.gateway';
@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }
    async getNotifications(userId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } })
        ]);
        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }
    async getUnreadCount(userId: string) {
        const count = await this.prisma.notification.count({
            where: { userId, isRead: false }
        });
        return { count };
    }
    async markAsRead(notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId }
        });
        if (!notification) {
            throw new NotFoundException('Notification not found');
        }
        const updated = await this.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
        return { success: true, notification: updated };
    }
    async markAsReadForUser(notificationId: string, userId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id: notificationId, userId }
        });
        if (!notification) {
            throw new NotFoundException('Notification not found');
        }
        const updated = await this.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true }
        });
        return { success: true, notification: updated };
    }
    async markAllAsRead(userId: string) {
        const result = await this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
        return { success: true, count: result.count };
    }
    async deleteNotification(notificationId: string) {
        const notification = await this.prisma.notification.findUnique({
            where: { id: notificationId }
        });
        if (!notification) {
            throw new NotFoundException('Notification not found');
        }
        await this.prisma.notification.delete({
            where: { id: notificationId }
        });
        return { success: true };
    }
    async deleteNotificationForUser(notificationId: string, userId: string) {
        const notification = await this.prisma.notification.findFirst({
            where: { id: notificationId, userId }
        });
        if (!notification) {
            throw new NotFoundException('Notification not found');
        }
        await this.prisma.notification.delete({
            where: { id: notificationId }
        });
        return { success: true };
    }
    async createBroadcastNotification(data: {
        type: string;
        title: string;
        content: string;
        data?: any;
    }) {
        const users = await this.prisma.user.findMany({
            select: { id: true }
        });
        const notifications = await this.prisma.notification.createMany({
            data: users.map(user => ({
                userId: user.id,
                type: data.type,
                title: data.title,
                content: data.content,
                data: data.data ? JSON.stringify(data.data) : null,
            }))
        });
        this.eventsGateway.server.emit('notification:broadcast', {
            type: data.type,
            title: data.title,
            content: data.content,
        });
        this.logger.log(`Broadcast notification sent to ${notifications.count} users`);
        return { success: true, count: notifications.count };
    }
    async notifyBetWin(userId: string, amount: number, marketTitle: string) {
        return this.createNotification({
            userId,
            type: 'BET_WIN',
            title: 'Prediction Won!',
            content: `Congratulations! You won ${amount.toFixed(2)} PTS on "${marketTitle}"`,
            data: { amount, marketTitle },
        });
    }
    async notifyBetLose(userId: string, amount: number, marketTitle: string) {
        return this.createNotification({
            userId,
            type: 'BET_LOSE',
            title: 'Prediction Lost',
            content: `Your prediction on "${marketTitle}" was not correct. Better luck next time!`,
            data: { amount, marketTitle },
        });
    }
    async notifyBattleResult(userId: string, won: boolean, agentName: string, reward?: number) {
        return this.createNotification({
            userId,
            type: 'BATTLE',
            title: won ? 'Battle Won!' : 'Battle Lost',
            content: won
                ? `You defeated ${agentName}! ${reward ? `Earned ${reward} PTS` : ''}`
                : `${agentName} won this round. Keep practicing!`,
            data: { won, agentName, reward },
        });
    }
    async notifyReferral(userId: string, refereeName: string, reward: number) {
        return this.createNotification({
            userId,
            type: 'REFERRAL',
            title: 'New Referral Reward!',
            content: `${refereeName} joined using your link. You earned ${reward} PTS!`,
            data: { refereeName, reward },
        });
    }
    async notifyReward(userId: string, title: string, amount: number, reason: string) {
        return this.createNotification({
            userId,
            type: 'REWARD',
            title,
            content: `You received ${amount} PTS for ${reason}`,
            data: { amount, reason },
        });
    }
    async notifySystem(userId: string, title: string, content: string) {
        return this.createNotification({
            userId,
            type: 'SYSTEM',
            title,
            content,
        });
    }
    async getAllNotifications(page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;
        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    user: {
                        select: { id: true, username: true, address: true }
                    }
                }
            }),
            this.prisma.notification.count()
        ]);
        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        };
    }
    async sendGlobalNotification(type: string, title: string, message: string) {
        const users = await this.prisma.user.findMany({
            select: { id: true }
        });
        if (users.length === 0) {
            return { success: true, sent: 0 };
        }
        const notifications = await this.prisma.notification.createMany({
            data: users.map(user => ({
                userId: user.id,
                type,
                title,
                content: message,
            }))
        });
        this.eventsGateway.server.emit('notification:broadcast', {
            type,
            title,
            content: message,
        });
        this.logger.log(`Global notification sent to ${notifications.count} users: ${title}`);
        return { success: true, sent: notifications.count };
    }
    async createNotification(userIdOrData: string | {
        userId: string;
        type: string;
        title: string;
        content: string;
        data?: any;
    }, type?: string, title?: string, message?: string, metadata?: any) {
        if (typeof userIdOrData === 'object') {
            const data = userIdOrData;
            const notification = await this.prisma.notification.create({
                data: {
                    userId: data.userId,
                    type: data.type,
                    title: data.title,
                    content: data.content,
                    data: data.data ? JSON.stringify(data.data) : null,
                }
            });
            this.eventsGateway.server.emit(`notification:${data.userId}`, notification);
            this.logger.log(`Notification created for user ${data.userId}: ${data.title}`);
            return notification;
        }
        else {
            const notification = await this.prisma.notification.create({
                data: {
                    userId: userIdOrData,
                    type: type!,
                    title: title!,
                    content: message!,
                    data: metadata ? JSON.stringify(metadata) : null,
                }
            });
            this.eventsGateway.server.emit(`notification:${userIdOrData}`, notification);
            this.logger.log(`Notification created for user ${userIdOrData}: ${title}`);
            return notification;
        }
    }
}

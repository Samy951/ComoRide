import prisma from '../../config/database';
import logger from '../../config/logger';
import { ConversationState, ConversationData, UserSessionData } from './state.types';
import { sessionConfig } from '../config/session.config';

export class SessionManager {
  private static instance: SessionManager;
  private sessionCache: Map<string, UserSessionData> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startSyncInterval();
    this.startCleanupInterval();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async getSession(phoneNumber: string): Promise<UserSessionData> {
    // Check cache first
    const cached = this.sessionCache.get(phoneNumber);
    if (cached) {
      return cached;
    }

    // Load from database
    let dbSession = await prisma.userSession.findUnique({
      where: { phoneNumber }
    });

    if (!dbSession) {
      // Create new session
      dbSession = await prisma.userSession.create({
        data: {
          phoneNumber,
          currentState: ConversationState.MENU,
          conversationData: sessionConfig.defaultConversationData,
          lastMessageAt: new Date(),
          timeoutCount: 0
        }
      });
      
      logger.info('New user session created', { phoneNumber: this.maskPhone(phoneNumber) });
    }

    const sessionData: UserSessionData = {
      id: dbSession.id,
      phoneNumber: dbSession.phoneNumber,
      currentState: dbSession.currentState as ConversationState,
      conversationData: (dbSession.conversationData as ConversationData) || sessionConfig.defaultConversationData,
      lastMessageAt: dbSession.lastMessageAt,
      timeoutCount: dbSession.timeoutCount,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt
    };

    // Cache the session
    this.sessionCache.set(phoneNumber, sessionData);
    return sessionData;
  }

  async updateSession(phoneNumber: string, updates: Partial<UserSessionData>): Promise<UserSessionData> {
    const currentSession = await this.getSession(phoneNumber);
    
    const updatedSession = {
      ...currentSession,
      ...updates,
      lastMessageAt: new Date(),
      updatedAt: new Date()
    };

    // Update cache
    this.sessionCache.set(phoneNumber, updatedSession);

    // Update database
    try {
      await prisma.userSession.update({
        where: { phoneNumber },
        data: {
          currentState: updatedSession.currentState,
          conversationData: updatedSession.conversationData,
          lastMessageAt: updatedSession.lastMessageAt,
          timeoutCount: updatedSession.timeoutCount
        }
      });
    } catch (error) {
      logger.error('Failed to update session in database', { 
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return updatedSession;
  }

  async setState(phoneNumber: string, state: ConversationState): Promise<void> {
    await this.updateSession(phoneNumber, { currentState: state });
  }

  async setConversationData(phoneNumber: string, data: Partial<ConversationData>): Promise<void> {
    const session = await this.getSession(phoneNumber);
    const updatedData = { ...session.conversationData, ...data };
    await this.updateSession(phoneNumber, { conversationData: updatedData });
  }

  async resetSession(phoneNumber: string): Promise<UserSessionData> {
    logger.info('Resetting user session', { phoneNumber: this.maskPhone(phoneNumber) });
    
    return await this.updateSession(phoneNumber, {
      currentState: ConversationState.MENU,
      conversationData: { ...sessionConfig.defaultConversationData },
      timeoutCount: 0
    });
  }

  async incrementTimeoutCount(phoneNumber: string): Promise<number> {
    const session = await this.getSession(phoneNumber);
    const newCount = session.timeoutCount + 1;
    
    await this.updateSession(phoneNumber, { timeoutCount: newCount });
    return newCount;
  }

  async deleteSession(phoneNumber: string): Promise<void> {
    this.sessionCache.delete(phoneNumber);
    
    try {
      await prisma.userSession.delete({
        where: { phoneNumber }
      });
      
      logger.info('User session deleted', { phoneNumber: this.maskPhone(phoneNumber) });
    } catch (error) {
      logger.error('Failed to delete session from database', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getActiveSessions(): Promise<UserSessionData[]> {
    const sessions: UserSessionData[] = [];
    
    for (const session of this.sessionCache.values()) {
      if (session.currentState !== ConversationState.MENU) {
        sessions.push(session);
      }
    }
    
    return sessions;
  }

  async getSessionCount(): Promise<number> {
    return this.sessionCache.size;
  }

  async restoreSessionsFromDB(): Promise<void> {
    try {
      const dbSessions = await prisma.userSession.findMany({
        where: {
          lastMessageAt: {
            gte: new Date(Date.now() - sessionConfig.cachePurge)
          }
        }
      });

      for (const dbSession of dbSessions) {
        const sessionData: UserSessionData = {
          id: dbSession.id,
          phoneNumber: dbSession.phoneNumber,
          currentState: dbSession.currentState as ConversationState,
          conversationData: (dbSession.conversationData as ConversationData) || sessionConfig.defaultConversationData,
          lastMessageAt: dbSession.lastMessageAt,
          timeoutCount: dbSession.timeoutCount,
          createdAt: dbSession.createdAt,
          updatedAt: dbSession.updatedAt
        };

        this.sessionCache.set(dbSession.phoneNumber, sessionData);
      }

      logger.info('Sessions restored from database', { count: dbSessions.length });
    } catch (error) {
      logger.error('Failed to restore sessions from database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private startSyncInterval(): void {
    this.syncInterval = setInterval(async () => {
      await this.syncToDatabase();
    }, sessionConfig.cacheSync);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, sessionConfig.sessionCleanupInterval);
  }

  private async syncToDatabase(): Promise<void> {
    try {
      const promises: Promise<any>[] = [];
      
      for (const [phoneNumber, session] of this.sessionCache.entries()) {
        promises.push(
          prisma.userSession.upsert({
            where: { phoneNumber },
            update: {
              currentState: session.currentState,
              conversationData: session.conversationData,
              lastMessageAt: session.lastMessageAt,
              timeoutCount: session.timeoutCount
            },
            create: {
              phoneNumber: session.phoneNumber,
              currentState: session.currentState,
              conversationData: session.conversationData,
              lastMessageAt: session.lastMessageAt,
              timeoutCount: session.timeoutCount
            }
          })
        );
      }

      await Promise.all(promises);
    } catch (error) {
      logger.error('Failed to sync sessions to database', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [phoneNumber, session] of this.sessionCache.entries()) {
      const lastActivity = session.lastMessageAt.getTime();
      
      if (now - lastActivity > sessionConfig.cachePurge) {
        expiredSessions.push(phoneNumber);
      }
    }

    // Remove from cache
    for (const phoneNumber of expiredSessions) {
      this.sessionCache.delete(phoneNumber);
    }

    // Remove from database
    if (expiredSessions.length > 0) {
      try {
        await prisma.userSession.deleteMany({
          where: {
            lastMessageAt: {
              lt: new Date(now - sessionConfig.cachePurge)
            }
          }
        });

        logger.info('Expired sessions cleaned up', { count: expiredSessions.length });
      } catch (error) {
        logger.error('Failed to cleanup expired sessions from database', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private maskPhone(phoneNumber: string): string {
    if (phoneNumber.length > 4) {
      return phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX';
    }
    return 'XXXX';
  }

  async shutdown(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Final sync before shutdown
    await this.syncToDatabase();
    
    logger.info('Session manager shut down');
  }
}
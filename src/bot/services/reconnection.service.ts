import { WhatsAppService } from './whatsapp.service';
import { SessionManager } from '../states/session.manager';
import { TimeoutManager } from '../states/timeout.manager';
import { MessageFormatter } from '../utils/message.formatter';
import { ConversationState } from '../states/state.types';
import logger from '@config/logger';

export class ReconnectionService {
  private static instance: ReconnectionService;
  private whatsappService!: WhatsAppService;
  private sessionManager: SessionManager;
  private timeoutManager: TimeoutManager;
  private pausedSessions: Map<string, Date> = new Map();

  private constructor() {
    this.sessionManager = SessionManager.getInstance();
    this.timeoutManager = TimeoutManager.getInstance();
  }

  static getInstance(): ReconnectionService {
    if (!ReconnectionService.instance) {
      ReconnectionService.instance = new ReconnectionService();
    }
    return ReconnectionService.instance;
  }

  setWhatsAppService(whatsappService: WhatsAppService): void {
    this.whatsappService = whatsappService;
    
    // Set up event handlers
    this.whatsappService.onDisconnected((reason: string) => {
      this.handleDisconnection(reason);
    });
    
    this.whatsappService.onReady(() => {
      this.handleReconnection();
    });
  }

  private async handleDisconnection(reason: string): Promise<void> {
    logger.warn('WhatsApp disconnected, pausing user sessions', { reason });
    
    try {
      // Get all active sessions
      const activeSessions = await this.sessionManager.getActiveSessions();
      
      // Pause timeouts for all active sessions
      for (const session of activeSessions) {
        await this.timeoutManager.pauseTimeouts(session.phoneNumber);
        this.pausedSessions.set(session.phoneNumber, new Date());
      }
      
      // Save current state to database
      // Sync sessions to database (syncToDatabase is now handled internally)
      
      logger.info('User sessions paused during disconnection', {
        activeSessionsCount: activeSessions.length
      });
    } catch (error) {
      logger.error('Failed to handle disconnection properly', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleReconnection(): Promise<void> {
    logger.info('WhatsApp reconnected, resuming user sessions');
    
    try {
      // Restore sessions from database
      await this.sessionManager.restoreSessionsFromDB();
      
      // Resume timeouts and notify users
      for (const [phoneNumber, pausedAt] of this.pausedSessions.entries()) {
        await this.resumeUserSession(phoneNumber, pausedAt);
      }
      
      // Clear paused sessions
      this.pausedSessions.clear();
      
      logger.info('User sessions resumed after reconnection');
    } catch (error) {
      logger.error('Failed to handle reconnection properly', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async resumeUserSession(phoneNumber: string, pausedAt: Date): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      const pauseDuration = Date.now() - pausedAt.getTime();
      
      // Resume timeouts
      await this.timeoutManager.resumeTimeouts(phoneNumber);
      
      // Send reconnection message based on session state
      let message: string;
      
      if (session.currentState === ConversationState.BOOKING_WAITING) {
        // Critical state - high priority message
        message = `🔄 *Connexion rétablie*

Votre recherche de chauffeur continue...
⏱️ Temps d'interruption : ${Math.round(pauseDuration / 1000)} secondes

📱 Vous recevrez une notification dès qu'un chauffeur accepte.

Tapez *ANNULER* si vous ne souhaitez plus attendre.`;
      } else if (session.currentState !== ConversationState.MENU && session.conversationData.pickupAddress) {
        // In progress booking - offer to continue
        message = MessageFormatter.formatReconnectionMessage(session.conversationData);
      } else {
        // General reconnection message
        message = MessageFormatter.formatReconnectionMessage();
      }
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('User session resumed', {
        phoneNumber: this.maskPhone(phoneNumber),
        pauseDuration: `${Math.round(pauseDuration / 1000)}s`,
        currentState: session.currentState
      });
    } catch (error) {
      logger.error('Failed to resume user session', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async forceReconnect(): Promise<void> {
    logger.info('Force reconnect initiated');
    
    try {
      // Disconnect current client
      await this.whatsappService.disconnect();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Reinitialize
      await this.whatsappService.initialize();
      
      logger.info('Force reconnect completed');
    } catch (error) {
      logger.error('Force reconnect failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async handleCriticalSessionReconnection(phoneNumber: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      
      // If user was waiting for driver, check booking status
      if (session.currentState === ConversationState.BOOKING_WAITING && session.conversationData.currentBookingId) {
        // In a real implementation, you would check the booking status from the database
        // and notify the user about any updates that happened during disconnection
        
        const message = `🔄 *Connexion rétablie*

Vérification de votre réservation en cours...

📱 Nous vous informerons immédiatement si un chauffeur a été assigné pendant l'interruption.`;
        
        await this.whatsappService.sendMessage(phoneNumber, message);
        
        // TODO: Implement booking status check and driver notification
        // const booking = await bookingService.getBooking(session.conversationData.currentBookingId);
        // if (booking.status === 'ACCEPTED') {
        //   // Notify about driver assignment
        // }
      }
    } catch (error) {
      logger.error('Failed to handle critical session reconnection', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  getConnectionStats(): {
    isConnected: boolean;
    pausedSessionsCount: number;
    lastDisconnection?: Date;
  } {
    return {
      isConnected: this.whatsappService?.isConnected() || false,
      pausedSessionsCount: this.pausedSessions.size,
      lastDisconnection: this.pausedSessions.size > 0 ? 
        new Date(Math.min(...Array.from(this.pausedSessions.values()).map(d => d.getTime()))) : 
        undefined
    };
  }

  async cleanupPausedSessions(maxAge: number = 3600000): Promise<void> {
    // Clean up paused sessions older than maxAge (default 1 hour)
    const now = Date.now();
    const toRemove: string[] = [];
    
    for (const [phoneNumber, pausedAt] of this.pausedSessions.entries()) {
      if (now - pausedAt.getTime() > maxAge) {
        toRemove.push(phoneNumber);
      }
    }
    
    for (const phoneNumber of toRemove) {
      this.pausedSessions.delete(phoneNumber);
      logger.info('Cleaned up old paused session', {
        phoneNumber: this.maskPhone(phoneNumber)
      });
    }
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4 ? 
      phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX' : 
      'XXXX';
  }

  shutdown(): void {
    this.pausedSessions.clear();
    logger.info('Reconnection service shut down');
  }
}
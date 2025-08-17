import logger from '../../config/logger';
import { SessionManager } from './session.manager';
import { ConversationState } from './state.types';
import { whatsappConfig } from '../config/whatsapp.config';
import { MessageFormatter } from '../utils/message.formatter';

export class TimeoutManager {
  private static instance: TimeoutManager;
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private sessionManager: SessionManager;
  private messageService: any; // Will be injected

  private constructor() {
    this.sessionManager = SessionManager.getInstance();
  }

  static getInstance(): TimeoutManager {
    if (!TimeoutManager.instance) {
      TimeoutManager.instance = new TimeoutManager();
    }
    return TimeoutManager.instance;
  }

  setMessageService(messageService: any): void {
    this.messageService = messageService;
  }

  scheduleTimeout(phoneNumber: string, type: 'WARNING' | 'RESET' | 'CLEANUP'): void {
    // Clear existing timeout
    this.clearTimeout(phoneNumber);

    let delay: number;
    let callback: () => Promise<void>;

    switch (type) {
      case 'WARNING':
        delay = whatsappConfig.timeoutWarning;
        callback = () => this.handleWarningTimeout(phoneNumber);
        break;
      
      case 'RESET':
        delay = whatsappConfig.timeoutReset;
        callback = () => this.handleResetTimeout(phoneNumber);
        break;
      
      case 'CLEANUP':
        delay = whatsappConfig.sessionMax;
        callback = () => this.handleCleanupTimeout(phoneNumber);
        break;
      
      default:
        return;
    }

    const timeout = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        logger.error('Timeout callback failed', {
          phoneNumber: this.maskPhone(phoneNumber),
          type,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, delay);

    this.timeouts.set(phoneNumber, timeout);

    logger.debug('Timeout scheduled', {
      phoneNumber: this.maskPhone(phoneNumber),
      type,
      delay: `${delay}ms`
    });
  }

  clearTimeout(phoneNumber: string): void {
    const timeout = this.timeouts.get(phoneNumber);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(phoneNumber);
    }
  }

  refreshTimeout(phoneNumber: string): void {
    // Clear existing timeout and schedule new warning
    this.clearTimeout(phoneNumber);
    this.scheduleTimeout(phoneNumber, 'WARNING');
  }

  private async handleWarningTimeout(phoneNumber: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      
      // Only send warning if user is in an active conversation (not MENU)
      if (session.currentState !== ConversationState.MENU) {
        const message = MessageFormatter.formatTimeoutWarning();
        
        if (this.messageService) {
          await this.messageService.sendMessage(phoneNumber, message);
        }

        // Schedule reset timeout
        this.scheduleTimeout(phoneNumber, 'RESET');
        
        logger.info('Warning timeout message sent', {
          phoneNumber: this.maskPhone(phoneNumber),
          currentState: session.currentState
        });
      }
    } catch (error) {
      logger.error('Failed to handle warning timeout', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleResetTimeout(phoneNumber: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);

      // Don't reset if user is waiting for driver (critical state)
      if (session.currentState === ConversationState.BOOKING_WAITING) {
        // Schedule another warning instead
        this.scheduleTimeout(phoneNumber, 'WARNING');
        return;
      }

      // Save conversation data before reset
      const conversationData = session.conversationData;
      
      // Reset to menu
      await this.sessionManager.resetSession(phoneNumber);
      
      // Send reset message
      const message = MessageFormatter.formatTimeoutReset();
      
      if (this.messageService) {
        await this.messageService.sendMessage(phoneNumber, message);
      }

      // Increment timeout count
      await this.sessionManager.incrementTimeoutCount(phoneNumber);

      // Schedule cleanup timeout
      this.scheduleTimeout(phoneNumber, 'CLEANUP');
      
      logger.info('Session reset due to timeout', {
        phoneNumber: this.maskPhone(phoneNumber),
        previousState: session.currentState,
        conversationDataSaved: !!conversationData.pickupAddress
      });
    } catch (error) {
      logger.error('Failed to handle reset timeout', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleCleanupTimeout(phoneNumber: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      
      // Final cleanup - delete session completely
      await this.sessionManager.deleteSession(phoneNumber);
      this.clearTimeout(phoneNumber);
      
      logger.info('Session cleaned up due to extended inactivity', {
        phoneNumber: this.maskPhone(phoneNumber),
        timeoutCount: session.timeoutCount
      });
    } catch (error) {
      logger.error('Failed to handle cleanup timeout', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async handleUserActivity(phoneNumber: string): Promise<void> {
    const session = await this.sessionManager.getSession(phoneNumber);
    
    // Reset timeout count on activity
    if (session.timeoutCount > 0) {
      await this.sessionManager.updateSession(phoneNumber, { timeoutCount: 0 });
    }

    // Refresh timeout
    this.refreshTimeout(phoneNumber);
  }

  async pauseTimeouts(phoneNumber: string): Promise<void> {
    this.clearTimeout(phoneNumber);
    
    logger.debug('Timeouts paused', {
      phoneNumber: this.maskPhone(phoneNumber)
    });
  }

  async resumeTimeouts(phoneNumber: string): Promise<void> {
    // Resume with warning timeout
    this.scheduleTimeout(phoneNumber, 'WARNING');
    
    logger.debug('Timeouts resumed', {
      phoneNumber: this.maskPhone(phoneNumber)
    });
  }

  getActiveTimeouts(): string[] {
    return Array.from(this.timeouts.keys()).map(phone => this.maskPhone(phone));
  }

  private maskPhone(phoneNumber: string): string {
    if (phoneNumber.length > 4) {
      return phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX';
    }
    return 'XXXX';
  }

  shutdown(): void {
    // Clear all timeouts
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
    
    logger.info('Timeout manager shut down');
  }
}
import { WhatsAppService } from './services/whatsapp.service';
import { ReconnectionService } from './services/reconnection.service';
import { NotificationService } from './services/notification.service';
import { DriverNotificationService } from './services/driver-notification.service';
import { MessageHandler } from './handlers/message.handler';
import { ErrorHandler } from './handlers/error.handler';
import { SessionManager } from './states/session.manager';
import { TimeoutManager } from './states/timeout.manager';
import logger from '../config/logger';

export class WhatsAppBot {
  private whatsappService!: WhatsAppService;
  private reconnectionService!: ReconnectionService;
  private notificationService!: NotificationService;
  private driverNotificationService!: DriverNotificationService;
  private messageHandler!: MessageHandler;
  private errorHandler!: ErrorHandler;
  private sessionManager!: SessionManager;
  private timeoutManager!: TimeoutManager;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize core services
    this.whatsappService = new WhatsAppService();
    this.reconnectionService = ReconnectionService.getInstance();
    this.notificationService = NotificationService.getInstance();
    this.driverNotificationService = DriverNotificationService.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.sessionManager = SessionManager.getInstance();
    this.timeoutManager = TimeoutManager.getInstance();
    
    // Initialize message handler
    this.messageHandler = new MessageHandler(this.whatsappService);
    
    // Set up service dependencies
    this.setupServiceDependencies();
    
    // Set up event handlers
    this.setupEventHandlers();
  }

  private setupServiceDependencies(): void {
    // Inject WhatsApp service into other services
    this.reconnectionService.setWhatsAppService(this.whatsappService);
    this.notificationService.setWhatsAppService(this.whatsappService);
    this.driverNotificationService.setWhatsAppService(this.whatsappService);
    this.errorHandler.setWhatsAppService(this.whatsappService);
    this.timeoutManager.setMessageService(this.whatsappService);
  }

  private setupEventHandlers(): void {
    // Handle incoming messages
    this.whatsappService.onMessage(async (message) => {
      try {
        await this.messageHandler.handleMessage(message);
      } catch (error) {
        const botError = ErrorHandler.createWhatsAppError(
          'Message handling failed',
          message.from,
          error instanceof Error ? error : undefined
        );
        await this.errorHandler.handleError(botError);
      }
    });

    // Handle WhatsApp ready event
    this.whatsappService.onReady(() => {
      logger.info('WhatsApp bot is fully operational');
      
      // Restore sessions after reconnection
      this.sessionManager.restoreSessionsFromDB().catch(error => {
        logger.error('Failed to restore sessions on startup', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    });

    // Handle disconnection events
    this.whatsappService.onDisconnected((reason) => {
      logger.warn('WhatsApp bot disconnected', { reason });
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('WhatsApp bot already initialized');
      return;
    }

    try {
      logger.info('Initializing WhatsApp bot...');
      
      // Initialize WhatsApp service
      await this.whatsappService.initialize();
      
      // Restore existing sessions
      await this.sessionManager.restoreSessionsFromDB();
      
      this.isInitialized = true;
      
      logger.info('WhatsApp bot initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize WhatsApp bot', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Shutting down WhatsApp bot...');
      
      // Shutdown services in reverse order
      this.timeoutManager.shutdown();
      await this.sessionManager.shutdown();
      this.errorHandler.shutdown();
      this.reconnectionService.shutdown();
      
      // Disconnect WhatsApp client
      await this.whatsappService.disconnect();
      
      this.isInitialized = false;
      
      logger.info('WhatsApp bot shut down successfully');
    } catch (error) {
      logger.error('Error during WhatsApp bot shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  isConnected(): boolean {
    return this.whatsappService?.isConnected() || false;
  }

  async getConnectionState(): Promise<string> {
    if (!this.whatsappService) {
      return 'not_initialized';
    }
    
    return await this.whatsappService.getConnectionState();
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isInitialized || !this.whatsappService) {
      logger.error('Cannot send message: Bot not initialized');
      return false;
    }

    return await this.whatsappService.sendMessage(phoneNumber, message);
  }

  // Public methods for external services to use notifications
  async notifyDriverFound(phoneNumber: string, driverInfo: {
    name: string;
    vehicleInfo: string;
    rating: number;
    phone?: string;
  }): Promise<void> {
    return await this.notificationService.notifyDriverFound(phoneNumber, driverInfo);
  }

  async notifyBookingCancelled(phoneNumber: string, reason: string): Promise<void> {
    return await this.notificationService.notifyBookingCancelled(phoneNumber, reason);
  }

  async notifyTripStarted(phoneNumber: string, tripInfo: {
    driverName: string;
    vehicleInfo: string;
    estimatedDuration?: number;
    estimatedFare?: number;
  }): Promise<void> {
    return await this.notificationService.notifyTripStarted(phoneNumber, tripInfo);
  }

  async notifyTripCompleted(phoneNumber: string, tripInfo: {
    driverName: string;
    finalFare: number;
    duration: number;
    distance?: number;
  }): Promise<void> {
    return await this.notificationService.notifyTripCompleted(phoneNumber, tripInfo);
  }

  async sendBulkNotification(phoneNumbers: string[], message: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    return await this.notificationService.sendBulkNotification(phoneNumbers, message);
  }

  // Health check methods
  getHealthStatus(): {
    botInitialized: boolean;
    whatsappConnected: boolean;
    activeSessions: number;
    activeTimeouts: number;
  } {
    return {
      botInitialized: this.isInitialized,
      whatsappConnected: this.isConnected(),
      activeSessions: this.sessionManager ? 0 : 0, // Would implement actual count
      activeTimeouts: this.timeoutManager ? this.timeoutManager.getActiveTimeouts().length : 0
    };
  }

  // Statistics methods
  async getStatistics(): Promise<{
    sessions: {
      total: number;
      active: number;
    };
    messages: {
      total: number;
      errors: number;
    };
    connections: {
      isConnected: boolean;
      lastDisconnection?: Date;
    };
  }> {
    const sessionCount = await this.sessionManager.getSessionCount();
    const activeSessions = await this.sessionManager.getActiveSessions();
    const connectionStats = this.reconnectionService.getConnectionStats();
    
    return {
      sessions: {
        total: sessionCount,
        active: activeSessions.length
      },
      messages: {
        total: 0, // Would implement actual tracking
        errors: 0 // Would implement actual tracking
      },
      connections: {
        isConnected: connectionStats.isConnected,
        lastDisconnection: connectionStats.lastDisconnection
      }
    };
  }

  // Force reconnection method for admin use
  async forceReconnect(): Promise<void> {
    return await this.reconnectionService.forceReconnect();
  }

  // Method to reset user session (for admin use)
  async resetUserSession(phoneNumber: string): Promise<void> {
    await this.sessionManager.resetSession(phoneNumber);
    logger.info('User session reset by admin', {
      phoneNumber: phoneNumber.length > 4 ? 
        phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX' : 
        'XXXX'
    });
  }

  // Method to get user session info (for admin use)
  async getUserSessionInfo(phoneNumber: string): Promise<any> {
    return await this.sessionManager.getSession(phoneNumber);
  }
}

// Export singleton instance
export const whatsappBot = new WhatsAppBot();
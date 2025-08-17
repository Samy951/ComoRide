import { WhatsAppService } from '../services/whatsapp.service';
import { SessionManager } from '../states/session.manager';
import { MessageFormatter } from '../utils/message.formatter';
import { PhoneUtils } from '../utils/phone.utils';
import logger from '@config/logger';

export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SESSION_ERROR = 'SESSION_ERROR',
  WHATSAPP_ERROR = 'WHATSAPP_ERROR',
  BOOKING_ERROR = 'BOOKING_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface BotError {
  type: ErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  phoneNumber?: string;
  originalError?: Error;
  context?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private whatsappService!: WhatsAppService;
  private sessionManager: SessionManager;
  private errorCounts: Map<string, number> = new Map();
  private readonly MAX_RETRIES = 3;

  private constructor() {
    this.sessionManager = SessionManager.getInstance();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  setWhatsAppService(whatsappService: WhatsAppService): void {
    this.whatsappService = whatsappService;
  }

  async handleError(error: BotError): Promise<void> {
    try {
      // Log the error
      this.logError(error);
      
      // Track error count for this user
      if (error.phoneNumber) {
        this.trackErrorCount(error.phoneNumber);
      }
      
      // Send user-friendly message
      if (error.phoneNumber && this.whatsappService) {
        await this.sendErrorMessage(error);
      }
      
      // Handle specific error types
      await this.handleSpecificError(error);
    } catch (handlingError) {
      logger.error('Error while handling error', {
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error'
      });
    }
  }

  private logError(error: BotError): void {
    const logData: Record<string, any> = {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      phoneNumber: error.phoneNumber ? PhoneUtils.maskPhoneNumber(error.phoneNumber) : undefined,
      context: error.context
    };

    if (error.originalError) {
      logData.stack = error.originalError.stack;
    }

    logger.error('Bot error occurred', logData);
  }

  private trackErrorCount(phoneNumber: string): void {
    const key = PhoneUtils.maskPhoneNumber(phoneNumber);
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);
    
    // Reset count after some time (5 minutes)
    setTimeout(() => {
      this.errorCounts.delete(key);
    }, 300000);
  }

  private async sendErrorMessage(error: BotError): Promise<void> {
    if (!this.whatsappService || !error.phoneNumber) {
      return;
    }

    const userKey = PhoneUtils.maskPhoneNumber(error.phoneNumber);
    const errorCount = this.errorCounts.get(userKey) || 0;

    let message: string;

    if (errorCount >= this.MAX_RETRIES) {
      // Too many errors - suggest contacting support
      message = `❌ *Problème technique persistant*

Nous rencontrons des difficultés répétées.

📞 **Contactez notre support :**
+269 XX XX XX XX

Ou tapez *AIDE* pour plus d'options.

Nous nous excusons pour la gêne occasionnée.`;
    } else if (error.retryable) {
      message = MessageFormatter.formatErrorMessage(error.userMessage, true);
    } else {
      message = MessageFormatter.formatErrorMessage(error.userMessage, false);
    }

    try {
      await this.whatsappService.sendMessage(error.phoneNumber, message);
    } catch (sendError) {
      logger.error('Failed to send error message to user', {
        phoneNumber: PhoneUtils.maskPhoneNumber(error.phoneNumber),
        error: sendError instanceof Error ? sendError.message : 'Unknown error'
      });
    }
  }

  private async handleSpecificError(error: BotError): Promise<void> {
    switch (error.type) {
      case ErrorType.SESSION_ERROR:
        await this.handleSessionError(error);
        break;
        
      case ErrorType.BOOKING_ERROR:
        await this.handleBookingError(error);
        break;
        
      case ErrorType.API_ERROR:
        await this.handleApiError(error);
        break;
        
      case ErrorType.WHATSAPP_ERROR:
        await this.handleWhatsAppError(error);
        break;
        
      case ErrorType.NETWORK_ERROR:
        await this.handleNetworkError(error);
        break;
        
      default:
        // Generic error handling
        break;
    }
  }

  private async handleSessionError(error: BotError): Promise<void> {
    if (error.phoneNumber) {
      try {
        // Reset session to known state
        await this.sessionManager.resetSession(error.phoneNumber);
        
        logger.info('Session reset due to error', {
          phoneNumber: PhoneUtils.maskPhoneNumber(error.phoneNumber)
        });
      } catch (resetError) {
        logger.error('Failed to reset session after error', {
          phoneNumber: PhoneUtils.maskPhoneNumber(error.phoneNumber),
          error: resetError instanceof Error ? resetError.message : 'Unknown error'
        });
      }
    }
  }

  private async handleBookingError(error: BotError): Promise<void> {
    if (error.phoneNumber) {
      try {
        // Save current booking data before reset
        const session = await this.sessionManager.getSession(error.phoneNumber);
        const bookingData = session.conversationData;
        
        // Reset to menu but keep some data for potential retry
        await this.sessionManager.resetSession(error.phoneNumber);
        
        if (bookingData.pickupAddress || bookingData.dropAddress) {
          await this.sessionManager.setConversationData(error.phoneNumber, {
            lastFailedBooking: bookingData
          });
        }
        
        logger.info('Booking data preserved after error', {
          phoneNumber: PhoneUtils.maskPhoneNumber(error.phoneNumber),
          hasPickup: !!bookingData.pickupAddress,
          hasDrop: !!bookingData.dropAddress
        });
      } catch (saveError) {
        logger.error('Failed to preserve booking data after error', {
          phoneNumber: PhoneUtils.maskPhoneNumber(error.phoneNumber),
          error: saveError instanceof Error ? saveError.message : 'Unknown error'
        });
      }
    }
  }

  private async handleApiError(error: BotError): Promise<void> {
    // API errors might be temporary - implement retry logic
    if (error.retryable && error.context?.retryCount !== undefined) {
      const retryCount = error.context.retryCount as number;
      
      if (retryCount < this.MAX_RETRIES) {
        logger.info('Scheduling API retry', {
          retryCount,
          maxRetries: this.MAX_RETRIES,
          phoneNumber: error.phoneNumber ? PhoneUtils.maskPhoneNumber(error.phoneNumber) : undefined
        });
        
        // Schedule retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => {
          // Retry would be implemented by the calling service
        }, delay);
      }
    }
  }

  private async handleWhatsAppError(error: BotError): Promise<void> {
    // WhatsApp specific errors might require reconnection
    logger.warn('WhatsApp error detected', {
      message: error.message,
      phoneNumber: error.phoneNumber ? PhoneUtils.maskPhoneNumber(error.phoneNumber) : undefined
    });
    
    // The reconnection service will handle this
  }

  private async handleNetworkError(error: BotError): Promise<void> {
    // Network errors are usually temporary
    logger.warn('Network error detected', {
      message: error.message,
      retryable: error.retryable
    });
  }

  // Factory methods for creating common errors
  static createNetworkError(phoneNumber: string, originalError?: Error): BotError {
    return {
      type: ErrorType.NETWORK_ERROR,
      message: 'Network connection failed',
      userMessage: 'Problème de connexion réseau. Veuillez réessayer dans quelques instants.',
      retryable: true,
      phoneNumber,
      originalError
    };
  }

  static createApiError(phoneNumber: string, endpoint: string, originalError?: Error): BotError {
    return {
      type: ErrorType.API_ERROR,
      message: `API call failed: ${endpoint}`,
      userMessage: 'Problème technique temporaire. Veuillez réessayer.',
      retryable: true,
      phoneNumber,
      originalError,
      context: { endpoint }
    };
  }

  static createValidationError(phoneNumber: string, field: string, value: string): BotError {
    return {
      type: ErrorType.VALIDATION_ERROR,
      message: `Validation failed for ${field}: ${value}`,
      userMessage: 'Les informations saisies ne sont pas valides. Veuillez réessayer.',
      retryable: true,
      phoneNumber,
      context: { field, value }
    };
  }

  static createSessionError(phoneNumber: string, originalError?: Error): BotError {
    return {
      type: ErrorType.SESSION_ERROR,
      message: 'Session management error',
      userMessage: 'Problème de session. Redirection vers le menu principal.',
      retryable: false,
      phoneNumber,
      originalError
    };
  }

  static createBookingError(phoneNumber: string, stage: string, originalError?: Error): BotError {
    return {
      type: ErrorType.BOOKING_ERROR,
      message: `Booking error at stage: ${stage}`,
      userMessage: 'Erreur lors de la réservation. Vos informations ont été sauvegardées.',
      retryable: true,
      phoneNumber,
      originalError,
      context: { stage }
    };
  }

  static createWhatsAppError(message: string, phoneNumber?: string, originalError?: Error): BotError {
    return {
      type: ErrorType.WHATSAPP_ERROR,
      message: `WhatsApp error: ${message}`,
      userMessage: 'Problème de messagerie. Reconnexion en cours...',
      retryable: true,
      phoneNumber,
      originalError
    };
  }

  // Method to check if user has too many errors
  hasExceededErrorLimit(phoneNumber: string): boolean {
    const userKey = PhoneUtils.maskPhoneNumber(phoneNumber);
    const errorCount = this.errorCounts.get(userKey) || 0;
    return errorCount >= this.MAX_RETRIES;
  }

  // Method to reset error count for a user
  resetErrorCount(phoneNumber: string): void {
    const userKey = PhoneUtils.maskPhoneNumber(phoneNumber);
    this.errorCounts.delete(userKey);
  }

  // Method to get error statistics
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    usersWithErrors: number;
  } {
    const stats = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      usersWithErrors: this.errorCounts.size
    };

    // Initialize error type counts
    Object.values(ErrorType).forEach(type => {
      stats.errorsByType[type] = 0;
    });

    // This would be enhanced with actual tracking
    return stats;
  }

  shutdown(): void {
    this.errorCounts.clear();
    logger.info('Error handler shut down');
  }
}
import { Message } from 'whatsapp-web.js';
import { ConversationState } from '../states/state.types';
import { SessionManager } from '../states/session.manager';
import { TimeoutManager } from '../states/timeout.manager';
import { WhatsAppService } from '../services/whatsapp.service';
import { PhoneUtils } from '../utils/phone.utils';
import { ValidationUtils } from '../utils/validation.utils';
import { MenuHandler } from './menu.handler';
import { DriverHandler } from './driver.handler';
import { BookingFlow } from '../flows/booking.flow';
import { HistoryFlow } from '../flows/history.flow';
import { HelpFlow } from '../flows/help.flow';
import { AuthService } from '../../services/auth.service';
import logger from '../../config/logger';

export class MessageHandler {
  private sessionManager: SessionManager;
  private timeoutManager: TimeoutManager;
  private whatsappService: WhatsAppService;
  private menuHandler: MenuHandler;
  private driverHandler: DriverHandler;
  private bookingFlow: BookingFlow;
  private historyFlow: HistoryFlow;
  private helpFlow: HelpFlow;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
    this.sessionManager = SessionManager.getInstance();
    this.timeoutManager = TimeoutManager.getInstance();
    
    // Initialize handlers and flows
    this.menuHandler = new MenuHandler(whatsappService);
    this.driverHandler = new DriverHandler(whatsappService);
    this.bookingFlow = new BookingFlow(whatsappService);
    this.historyFlow = new HistoryFlow(whatsappService);
    this.helpFlow = new HelpFlow(whatsappService);
  }

  async handleMessage(message: Message): Promise<void> {
    const phoneNumber = PhoneUtils.normalizePhoneNumber(message.from);
    const messageText = message.body?.trim() || '';

    try {
      // Log message processing start
      const startTime = Date.now();
      
      // Handle user activity (reset timeouts)
      await this.timeoutManager.handleUserActivity(phoneNumber);
      
      // Get current session
      const session = await this.sessionManager.getSession(phoneNumber);
      
      // Detect user type and route accordingly
      const userType = await this.detectUserType(phoneNumber, messageText, session);
      
      // Check for global commands first
      if (await this.handleGlobalCommands(phoneNumber, messageText, userType)) {
        return;
      }
      
      // Route message based on user type and current state
      await this.routeMessage(phoneNumber, messageText, session.currentState, userType);
      
      // Log processing time
      const processingTime = Date.now() - startTime;
      logger.info('Message processed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        currentState: session.currentState,
        processingTime: `${processingTime}ms`
      });
    } catch (error) {
      logger.error('Error handling message', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Une erreur est survenue. Veuillez réessayer.');
    }
  }

  private async detectUserType(phoneNumber: string, messageText: string, session: any): Promise<'driver' | 'customer' | 'unknown'> {
    try {
      // Check if user is in temporary client mode (driver acting as client)
      if (session.conversationData.temporaryClientMode) {
        return 'customer';
      }

      // Check explicit client mode commands from drivers
      const lowerText = messageText.toLowerCase().trim();
      const clientCommands = ['réserver', 'booking', 'course', 'client', 'mode client'];
      if (clientCommands.some(cmd => lowerText.includes(cmd))) {
        const user = await AuthService.findUserByPhone(phoneNumber);
        if (user?.type === 'driver') {
          // Driver wants to use client mode
          await this.driverHandler.switchToClientMode(phoneNumber);
          return 'customer';
        }
      }

      // Get user from database
      const user = await AuthService.findUserByPhone(phoneNumber);
      
      if (!user) {
        return 'unknown';
      }

      // If driver and not explicitly requesting client mode, default to driver mode
      if (user.type === 'driver') {
        // Initialize driver mode if not already set
        if (!session.conversationData.isDriverMode) {
          await this.driverHandler.initializeDriverMode(phoneNumber);
        }
        return 'driver';
      }

      return 'customer';
    } catch (error) {
      logger.error('Failed to detect user type', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 'unknown';
    }
  }

  private async handleGlobalCommands(phoneNumber: string, messageText: string, userType: 'driver' | 'customer' | 'unknown'): Promise<boolean> {
    const lowerText = messageText.toLowerCase();
    
    // Menu/Home commands - route based on user type
    if (ValidationUtils.isMenuCommand(lowerText)) {
      if (userType === 'driver' && !await this.driverHandler.isDriverInClientMode(phoneNumber)) {
        await this.driverHandler.initializeDriverMode(phoneNumber);
      } else {
        await this.menuHandler.showMainMenu(phoneNumber);
      }
      return true;
    }

    // Driver-specific global commands
    if (userType === 'driver' && await this.driverHandler.handleGlobalDriverCommands(phoneNumber, messageText)) {
      return true;
    }
    
    // Help commands
    if (ValidationUtils.isHelpCommand(lowerText)) {
      await this.helpFlow.handleHelpMode(phoneNumber);
      return true;
    }
    
    // Continue commands (for reconnection)
    if (ValidationUtils.isContinueCommand(lowerText)) {
      await this.handleContinueCommand(phoneNumber);
      return true;
    }
    
    // Cancel commands
    if (ValidationUtils.isCancelOption(lowerText)) {
      await this.handleCancelCommand(phoneNumber);
      return true;
    }

    return false;
  }

  private async routeMessage(phoneNumber: string, messageText: string, currentState: ConversationState, userType: 'driver' | 'customer' | 'unknown'): Promise<void> {
    // Route driver states to driver handler
    if (this.isDriverState(currentState)) {
      await this.driverHandler.handleDriverMessage(phoneNumber, messageText, currentState);
      return;
    }

    // Route customer/unknown users to existing flows
    switch (currentState) {
      case ConversationState.MENU:
        await this.menuHandler.handleMenuSelection(phoneNumber, messageText);
        break;
        
      case ConversationState.BOOKING_START:
        await this.bookingFlow.handlePickupAddress(phoneNumber, messageText);
        break;
        
      case ConversationState.BOOKING_PICKUP:
        await this.bookingFlow.handlePickupAddress(phoneNumber, messageText);
        break;
        
      case ConversationState.BOOKING_DROP:
        await this.bookingFlow.handleDropAddress(phoneNumber, messageText);
        break;
        
      case ConversationState.BOOKING_TIME:
        await this.bookingFlow.handleTimeSelection(phoneNumber, messageText);
        break;
        
      case ConversationState.BOOKING_CONFIRM:
        await this.bookingFlow.handleBookingConfirmation(phoneNumber, messageText);
        break;
        
      case ConversationState.BOOKING_WAITING:
        await this.handleBookingWaiting(phoneNumber, messageText);
        break;
        
      case ConversationState.HISTORY_VIEW:
        await this.historyFlow.handleHistoryAction(phoneNumber, messageText);
        break;
        
      case ConversationState.HELP_MODE:
        await this.helpFlow.handleHelpAction(phoneNumber, messageText);
        break;
        
      default:
        // Unknown state, reset to appropriate menu based on user type
        logger.warn('Unknown conversation state, resetting to menu', {
          phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
          state: currentState,
          userType
        });
        
        if (userType === 'driver') {
          await this.driverHandler.initializeDriverMode(phoneNumber);
        } else {
          await this.menuHandler.showMainMenu(phoneNumber);
        }
    }
  }

  private isDriverState(state: ConversationState): boolean {
    const driverStates = [
      ConversationState.DRIVER_MENU,
      ConversationState.DRIVER_AVAILABILITY,
      ConversationState.DRIVER_BOOKING_NOTIFY,
      ConversationState.DRIVER_BOOKING_ACCEPT,
      ConversationState.DRIVER_TRIP_STATUS
    ];
    
    return driverStates.includes(state);
  }

  private async handleBookingWaiting(phoneNumber: string, messageText: string): Promise<void> {
    const lowerText = messageText.toLowerCase();
    
    if (lowerText.includes('annul') || ValidationUtils.isCancelOption(messageText)) {
      // Cancel the booking
      const session = await this.sessionManager.getSession(phoneNumber);
      
      if (session.conversationData.currentBookingId) {
        // TODO: Call booking service to cancel the booking
        // await bookingService.cancelBooking(session.conversationData.currentBookingId);
      }
      
      await this.sessionManager.resetSession(phoneNumber);
      
      const message = `❌ *Recherche annulée*

Votre réservation a été annulée.

Vous pouvez faire une nouvelle réservation quand vous voulez.`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      await this.menuHandler.showMainMenu(phoneNumber);
      
      logger.info('Booking search cancelled by user', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber)
      });
    } else {
      // Inform user that we're still searching
      const message = `🔍 Recherche en cours...

⏱️ Un chauffeur vous sera assigné dans les prochaines minutes.

Tapez *ANNULER* pour annuler la recherche.`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
    }
  }

  private async handleContinueCommand(phoneNumber: string): Promise<void> {
    const session = await this.sessionManager.getSession(phoneNumber);
    
    // If user has partial booking data, continue where they left off
    if (session.conversationData.pickupAddress && !session.conversationData.dropAddress) {
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_DROP);
      await this.bookingFlow.handleDropAddress(phoneNumber, ''); // Will show the prompt
    } else if (session.conversationData.dropAddress && !session.conversationData.pickupTime) {
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_TIME);
      await this.bookingFlow.handleTimeSelection(phoneNumber, ''); // Will show the prompt
    } else {
      // No clear continuation point, show menu
      await this.menuHandler.showMainMenu(phoneNumber);
    }
  }

  private async handleCancelCommand(phoneNumber: string): Promise<void> {
    const session = await this.sessionManager.getSession(phoneNumber);
    
    // If in critical booking state, confirm cancellation
    if (session.currentState === ConversationState.BOOKING_WAITING) {
      const message = `🤔 Êtes-vous sûr de vouloir annuler votre réservation ?

*1* - Oui, annuler
*2* - Non, continuer la recherche`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      // Set a flag to handle the confirmation
      await this.sessionManager.setConversationData(phoneNumber, {
        pendingCancellation: true
      });
    } else {
      // Standard cancellation
      await this.sessionManager.resetSession(phoneNumber);
      
      const message = `❌ *Action annulée*

Retour au menu principal.`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      await this.menuHandler.showMainMenu(phoneNumber);
    }
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    try {
      const message = `❌ ${errorMessage}

Tapez *MENU* pour revenir au menu principal ou *AIDE* pour obtenir de l'aide.`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      // Reset session to prevent user from being stuck
      await this.sessionManager.resetSession(phoneNumber);
    } catch (error) {
      logger.error('Failed to send error message', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Method to handle typing indicators
  async handleTypingIndicator(phoneNumber: string, isTyping: boolean): Promise<void> {
    try {
      if (isTyping) {
        await this.whatsappService.sendTyping(phoneNumber);
      } else {
        await this.whatsappService.clearTyping(phoneNumber);
      }
    } catch (error) {
      // Typing indicators are not critical, just log
      logger.debug('Failed to handle typing indicator', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Method to get message statistics
  getMessageStats(): {
    totalMessages: number;
    errorCount: number;
    averageProcessingTime: number;
  } {
    // This would be implemented with actual tracking
    return {
      totalMessages: 0,
      errorCount: 0,
      averageProcessingTime: 0
    };
  }
}
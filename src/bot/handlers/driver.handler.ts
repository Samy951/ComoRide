import { ConversationState } from '../states/state.types';
import { SessionManager } from '../states/session.manager';
import { WhatsAppService } from '../services/whatsapp.service';
import { PhoneUtils } from '../utils/phone.utils';
import { ValidationUtils } from '../utils/validation.utils';
import { DriverFlow } from '../flows/driver.flow';
import { AuthService } from '../../services/auth.service';
import logger from '../../config/logger';

export class DriverHandler {
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;
  private driverFlow: DriverFlow;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
    this.sessionManager = SessionManager.getInstance();
    this.driverFlow = new DriverFlow(whatsappService);
  }

  async handleDriverMessage(phoneNumber: string, message: string, state: ConversationState): Promise<void> {
    try {
      // Verify driver exists and is verified
      const user = await AuthService.findUserByPhone(phoneNumber);
      
      if (!user || user.type !== 'driver') {
        await this.handleNonDriverUser(phoneNumber);
        return;
      }

      // Check for global driver commands first
      if (await this.handleGlobalDriverCommands(phoneNumber, message)) {
        return;
      }

      // Route based on current state
      await this.routeDriverMessage(phoneNumber, message, state);
      
      logger.info('Driver message processed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        state,
        messageLength: message.length
      });
    } catch (error) {
      logger.error('Failed to handle driver message', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        state,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors du traitement du message');
    }
  }

  async routeDriverMessage(phoneNumber: string, message: string, state: ConversationState): Promise<void> {
    switch (state) {
      case ConversationState.DRIVER_MENU:
        await this.driverFlow.handleMenuSelection(phoneNumber, message);
        break;
        
      case ConversationState.DRIVER_AVAILABILITY:
        // Return to menu after availability change
        await this.driverFlow.handleDriverMenu(phoneNumber);
        break;
        
      case ConversationState.DRIVER_BOOKING_NOTIFY:
        await this.driverFlow.handleBookingResponse(phoneNumber, message);
        break;
        
      case ConversationState.DRIVER_BOOKING_ACCEPT:
        await this.driverFlow.handleBookingResponse(phoneNumber, message);
        break;
        
      case ConversationState.DRIVER_TRIP_STATUS:
        await this.driverFlow.handleTripStatusAction(phoneNumber, message);
        break;
        
      default:
        // Unknown driver state, reset to driver menu
        logger.warn('Unknown driver state, resetting to driver menu', {
          phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
          state
        });
        await this.driverFlow.handleDriverMenu(phoneNumber);
    }
  }

  async handleGlobalDriverCommands(phoneNumber: string, message: string): Promise<boolean> {
    const lowerMessage = message.toLowerCase().trim();
    
    // Quick availability commands
    if (lowerMessage === 'disponible' || lowerMessage === 'dispo') {
      await this.driverFlow.handleAvailabilityToggle(phoneNumber, true);
      return true;
    }
    
    if (lowerMessage === 'occupé' || lowerMessage === 'occupé' || lowerMessage === 'busy') {
      await this.driverFlow.handleAvailabilityToggle(phoneNumber, false);
      return true;
    }
    
    // Quick courses view
    if (lowerMessage === 'courses' || lowerMessage === 'mes courses') {
      await this.driverFlow.handleTripStatus(phoneNumber);
      return true;
    }
    
    // Switch to client mode
    if (lowerMessage === 'client' || lowerMessage === 'mode client' || lowerMessage === 'réserver') {
      await this.driverFlow.switchToClientMode(phoneNumber);
      return true;
    }
    
    // Menu command
    if (ValidationUtils.isMenuCommand(lowerMessage)) {
      await this.driverFlow.handleDriverMenu(phoneNumber);
      return true;
    }
    
    return false;
  }

  async initializeDriverMode(phoneNumber: string): Promise<void> {
    try {
      // Set driver mode in session
      await this.sessionManager.setConversationData(phoneNumber, {
        isDriverMode: true,
        temporaryClientMode: false
      });
      
      // Show driver menu
      await this.driverFlow.handleDriverMenu(phoneNumber);
      
      logger.info('Driver mode initialized', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber)
      });
    } catch (error) {
      logger.error('Failed to initialize driver mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'initialisation du mode chauffeur');
    }
  }

  async switchToClientMode(phoneNumber: string): Promise<void> {
    await this.driverFlow.switchToClientMode(phoneNumber);
  }

  async isDriverInDriverMode(phoneNumber: string): Promise<boolean> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      return session.conversationData.isDriverMode === true && 
             !session.conversationData.temporaryClientMode;
    } catch (error) {
      logger.error('Failed to check driver mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async isDriverInClientMode(phoneNumber: string): Promise<boolean> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      return session.conversationData.temporaryClientMode === true;
    } catch (error) {
      logger.error('Failed to check client mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  async returnToDriverMode(phoneNumber: string): Promise<void> {
    try {
      // Reset to driver mode
      await this.sessionManager.setConversationData(phoneNumber, {
        isDriverMode: true,
        temporaryClientMode: false
      });
      
      const message = `🔄 *RETOUR MODE CHAUFFEUR*

Retour au menu chauffeur...`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      // Show driver menu after short delay
      setTimeout(async () => {
        await this.driverFlow.handleDriverMenu(phoneNumber);
      }, 1500);
      
      logger.info('Driver returned to driver mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber)
      });
    } catch (error) {
      logger.error('Failed to return to driver mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Method for external services to send booking notifications
  async notifyBooking(phoneNumber: string, booking: any): Promise<void> {
    try {
      await this.driverFlow.handleBookingNotification(phoneNumber, booking);
      
      logger.info('Booking notification sent to driver', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId: booking.id
      });
    } catch (error) {
      logger.error('Failed to notify driver of booking', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId: booking.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleNonDriverUser(phoneNumber: string): Promise<void> {
    const message = `❌ *ACCÈS CHAUFFEUR NON AUTORISÉ*

Ce numéro n'est pas enregistré comme chauffeur.
Pour devenir chauffeur Como Ride, contactez :

📞 Administration : +269 XXX XXXX
📧 Email : chauffeurs@comoride.com

Retour au menu client...`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    // Switch to regular menu after delay
    setTimeout(async () => {
      const { MenuHandler } = await import('./menu.handler');
      const menuHandler = new MenuHandler(this.whatsappService);
      await menuHandler.showMainMenu(phoneNumber);
    }, 3000);
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    const message = `🔧 *ERREUR CHAUFFEUR*
${errorMessage}

Tapez *MENU* pour revenir au menu chauffeur ou contactez le support.

📞 Support : +269 XXX XXXX`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    // Reset to driver menu after delay
    setTimeout(async () => {
      await this.driverFlow.handleDriverMenu(phoneNumber);
    }, 5000);
  }

  // Statistics and monitoring methods
  getDriverHandlerStats(): {
    messagesProcessed: number;
    errorsEncountered: number;
    activeDriverSessions: number;
  } {
    // This would be implemented with actual tracking
    return {
      messagesProcessed: 0,
      errorsEncountered: 0,
      activeDriverSessions: 0
    };
  }
}
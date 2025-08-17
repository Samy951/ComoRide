// Removed unused import
import { SessionManager } from '../states/session.manager';
import { ConversationState } from '../states/state.types';
import { WhatsAppService } from '../services/whatsapp.service';
import { MessageFormatter } from '../utils/message.formatter';
import { ValidationUtils } from '../utils/validation.utils';
import { PhoneUtils } from '../utils/phone.utils';
import { BookingFlow } from '../flows/booking.flow';
import { HistoryFlow } from '../flows/history.flow';
import { HelpFlow } from '../flows/help.flow';
import logger from '../../config/logger';

// Import existing services to get customer name
import { AuthService } from '@services/auth.service';

export class MenuHandler {
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;
  private bookingFlow: BookingFlow;
  private historyFlow: HistoryFlow;
  private helpFlow: HelpFlow;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
    this.sessionManager = SessionManager.getInstance();
    this.bookingFlow = new BookingFlow(whatsappService);
    this.historyFlow = new HistoryFlow(whatsappService);
    this.helpFlow = new HelpFlow(whatsappService);
  }

  async showMainMenu(phoneNumber: string, customMessage?: string): Promise<void> {
    try {
      // Check if user is a driver in temporary client mode
      const user = await AuthService.findUserByPhone(phoneNumber);
      const session = await this.sessionManager.getSession(phoneNumber);
      
      if (user?.type === 'driver' && session.conversationData.temporaryClientMode) {
        await this.showDriverClientMenu(phoneNumber, customMessage, user.name);
        return;
      }
      
      // Reset session to menu state for regular customers
      await this.sessionManager.resetSession(phoneNumber);
      
      // Get customer name if available
      const customerName = await this.getCustomerName(phoneNumber);
      
      const message = customMessage || MessageFormatter.formatWelcomeMenu(customerName);
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Main menu displayed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        hasCustomerName: !!customerName,
        userType: user?.type || 'unknown'
      });
    } catch (error) {
      logger.error('Failed to show main menu', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback message
      const fallbackMessage = MessageFormatter.formatWelcomeMenu();
      await this.whatsappService.sendMessage(phoneNumber, fallbackMessage);
    }
  }

  async handleMenuSelection(phoneNumber: string, input: string): Promise<void> {
    try {
      // Check if driver in client mode has special options
      const user = await AuthService.findUserByPhone(phoneNumber);
      const session = await this.sessionManager.getSession(phoneNumber);
      
      if (user?.type === 'driver' && session.conversationData.temporaryClientMode) {
        await this.handleDriverClientMenuSelection(phoneNumber, input, user.name);
        return;
      }

      if (!ValidationUtils.isMenuOption(input)) {
        await this.handleInvalidMenuInput(phoneNumber, input);
        return;
      }

      const option = ValidationUtils.parseMenuOption(input);
      
      switch (option) {
        case 1:
          // Start booking flow
          await this.bookingFlow.handleBookingStart(phoneNumber);
          break;
          
        case 2:
          // Show history
          await this.historyFlow.handleHistoryView(phoneNumber);
          break;
          
        case 3:
          // Show help
          await this.helpFlow.handleHelpMode(phoneNumber);
          break;
          
        case 0:
          // Show menu again (refresh)
          await this.showMainMenu(phoneNumber);
          break;
          
        default:
          await this.handleInvalidMenuInput(phoneNumber, input);
      }
      
      logger.info('Menu selection processed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        selectedOption: option
      });
    } catch (error) {
      logger.error('Failed to handle menu selection', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la sélection du menu');
    }
  }

  private async handleInvalidMenuInput(phoneNumber: string, input: string): Promise<void> {
    // Check if it's a command or question
    const lowerInput = input.toLowerCase().trim();
    
    if (this.isQuestionOrCommand(lowerInput)) {
      await this.handleQuestionOrCommand(phoneNumber, lowerInput);
      return;
    }
    
    // Send invalid input message
    const message = `${MessageFormatter.formatInvalidInput()}

${MessageFormatter.formatWelcomeMenu()}`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Invalid menu input handled', {
      phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
      input: input.substring(0, 50) // Log first 50 chars only
    });
  }

  private isQuestionOrCommand(input: string): boolean {
    const questionWords = [
      'comment', 'combien', 'où', 'quand', 'pourquoi', 'que', 'qui',
      'tarif', 'prix', 'coût', 'zone', 'horaire', 'disponible',
      'réserver', 'booking', 'course', 'trajet', 'chauffeur',
      'paiement', 'orange money', 'annuler', 'modifier'
    ];
    
    return questionWords.some(word => input.includes(word)) || 
           input.includes('?') || 
           input.length > 20; // Likely a question if long
  }

  private async handleQuestionOrCommand(phoneNumber: string, input: string): Promise<void> {
    // Route common questions to appropriate responses
    if (input.includes('tarif') || input.includes('prix') || input.includes('coût')) {
      await this.showPricingInfo(phoneNumber);
    } else if (input.includes('zone') || input.includes('où')) {
      await this.showZoneInfo(phoneNumber);
    } else if (input.includes('horaire') || input.includes('quand')) {
      await this.showScheduleInfo(phoneNumber);
    } else if (input.includes('réserv') || input.includes('booking') || input.includes('course')) {
      await this.bookingFlow.handleBookingStart(phoneNumber);
    } else if (input.includes('paiement') || input.includes('orange money')) {
      await this.showPaymentInfo(phoneNumber);
    } else {
      // General question - redirect to help
      const message = `❓ Pour répondre à votre question : "${input.substring(0, 50)}${input.length > 50 ? '...' : ''}"

Je vous redirige vers l'aide où vous trouverez toutes les informations !`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      await this.helpFlow.handleHelpMode(phoneNumber);
    }
  }

  private async showPricingInfo(phoneNumber: string): Promise<void> {
    const message = `💰 *Tarifs Como Ride*

🏙️ **Intra-ville** : 1000-2000 KMF
🌍 **Inter-zones** : 2000-4000 KMF  
✈️ **Aéroport** : +1000 KMF de supplément
🌙 **Nocturne** (22h-6h) : +500 KMF

💡 Le tarif exact est calculé selon la distance et affiché avant confirmation.

*1* - Faire une réservation
*3* - Plus d'infos tarifs
*0* - Retour menu`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showZoneInfo(phoneNumber: string): Promise<void> {
    const message = `🗺️ *Zones desservies*

**🏙️ Grande Comore**
Moroni, Itsandra, Mitsoudjé, Aéroport

**🏝️ Anjouan** 
Mutsamudu, Domoni, Sima, Ouani

**🌴 Mohéli**
Fomboni, Nioumachoua

⏰ Service 6h-22h (24h/24 aéroports)

*1* - Réserver un trajet
*3* - Aide complète
*0* - Retour menu`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showScheduleInfo(phoneNumber: string): Promise<void> {
    const message = `🕐 *Horaires Como Ride*

**📅 Service quotidien**
🌅 6h00 - 22h00 tous les jours

**✈️ Aéroports** 
🌙 Service 24h/24

**⚡ Réservation**
📱 Immédiate ou jusqu'à 24h à l'avance
⏱️ Chauffeur assigné en 30-90 secondes

*1* - Réserver maintenant
*2* - Voir mon historique  
*0* - Retour menu`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showPaymentInfo(phoneNumber: string): Promise<void> {
    const message = `💳 *Modes de paiement*

**💵 Espèces** (Disponible)
Paiement direct au chauffeur

**📱 Orange Money** (Bientôt)
Paiement sécurisé en développement

**🧾 Transparence**
Prix affiché = prix final (±10% max)
Reçu fourni pour chaque course

*1* - Faire une réservation
*3* - Plus d'infos paiement
*0* - Retour menu`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async getCustomerName(phoneNumber: string): Promise<string | undefined> {
    try {
      const customer = await AuthService.findUserByPhone(phoneNumber);
      return customer?.name;
    } catch (error) {
      // Customer not found or error - return undefined
      return undefined;
    }
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    const message = MessageFormatter.formatErrorMessage(errorMessage);
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    // Show menu as fallback
    setTimeout(async () => {
      await this.showMainMenu(phoneNumber);
    }, 2000);
  }

  // Method to show welcome message for new users
  async showWelcomeForNewUser(phoneNumber: string): Promise<void> {
    const message = `🎉 *Bienvenue chez Como Ride !*

Votre application de transport aux Comores ! 🚗

Como Ride vous propose :
✅ Chauffeurs vérifiés et professionnels
✅ Tarifs transparents et compétitifs  
✅ Service rapide et fiable
✅ Couverture Grande Comore, Anjouan, Mohéli

🆕 **Première fois ?** 
Tout se passe ici via WhatsApp !

${MessageFormatter.formatWelcomeMenu()}`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Welcome message sent to new user', {
      phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber)
    });
  }

  // Method to show returning user message
  async showWelcomeForReturningUser(phoneNumber: string, customerName: string): Promise<void> {
    const message = `👋 *Bon retour ${customerName} !*

Ravi de vous revoir sur Como Ride ! 

${MessageFormatter.formatWelcomeMenu(customerName)}`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Returning user welcome sent', {
      phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
      customerName
    });
  }

  // New methods for driver client mode
  private async showDriverClientMenu(phoneNumber: string, customMessage?: string, driverName?: string): Promise<void> {
    // Reset to menu state but keep client mode flag
    await this.sessionManager.setState(phoneNumber, ConversationState.MENU);
    
    const name = driverName || 'Chauffeur';
    
    const message = customMessage || `👤 *MODE CLIENT - ${name}*

Vous pouvez réserver une course comme un client :

*1* - 🚗 Réserver une course
*2* - 📋 Mon historique client  
*3* - ❓ Aide
*9* - 🔄 Retour mode chauffeur

*0* - 🔄 Actualiser`;

    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Driver client menu displayed', {
      phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
      driverName: name
    });
  }

  private async handleDriverClientMenuSelection(phoneNumber: string, input: string, driverName: string): Promise<void> {
    if (!ValidationUtils.isMenuOption(input)) {
      await this.handleInvalidMenuInput(phoneNumber, input);
      return;
    }

    const option = ValidationUtils.parseMenuOption(input);
    
    switch (option) {
      case 1:
        // Start booking flow as client
        await this.bookingFlow.handleBookingStart(phoneNumber);
        break;
        
      case 2:
        // Show client history (only customer bookings)
        await this.historyFlow.handleHistoryView(phoneNumber);
        break;
        
      case 3:
        // Show help
        await this.helpFlow.handleHelpMode(phoneNumber);
        break;
        
      case 9:
        // Return to driver mode
        await this.returnToDriverMode(phoneNumber, driverName);
        break;
        
      case 0:
        // Show menu again (refresh)
        await this.showDriverClientMenu(phoneNumber, undefined, driverName);
        break;
        
      default:
        await this.handleInvalidMenuInput(phoneNumber, input);
    }
    
    logger.info('Driver client menu selection processed', {
      phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
      selectedOption: option,
      driverName
    });
  }

  private async returnToDriverMode(phoneNumber: string, driverName: string): Promise<void> {
    try {
      // Import DriverHandler dynamically to avoid circular dependency
      const { DriverHandler } = await import('./driver.handler');
      const driverHandler = new DriverHandler(this.whatsappService);
      
      await driverHandler.returnToDriverMode(phoneNumber);
      
      logger.info('Driver returned to driver mode from client menu', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        driverName
      });
    } catch (error) {
      logger.error('Failed to return to driver mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        driverName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback - show regular menu
      await this.showMainMenu(phoneNumber);
    }
  }
}
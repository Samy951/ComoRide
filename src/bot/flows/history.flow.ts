import { ConversationState } from '../states/state.types';
import { SessionManager } from '../states/session.manager';
import { MessageFormatter } from '../utils/message.formatter';
import { ValidationUtils } from '../utils/validation.utils';
import { WhatsAppService } from '../services/whatsapp.service';
import logger from '@config/logger';

// Import existing services
import { AuthService } from '@services/auth.service';

export class HistoryFlow {
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.sessionManager = SessionManager.getInstance();
    this.whatsappService = whatsappService;
  }

  async handleHistoryView(phoneNumber: string): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.HISTORY_VIEW);
      
      const customer = await this.getCustomerByPhone(phoneNumber);
      
      if (!customer) {
        const message = `📚 *Historique des trajets*

Aucun historique trouvé. Vous devez d'abord effectuer une réservation.

*1* - Faire ma première réservation
*0* - Retour menu principal`;
        
        await this.whatsappService.sendMessage(phoneNumber, message);
        return;
      }

      const trips = await this.getCustomerTrips(customer.id);
      const message = MessageFormatter.formatBookingHistory(trips);
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('History displayed', {
        phoneNumber: this.maskPhone(phoneNumber),
        tripsCount: trips.length
      });
    } catch (error) {
      logger.error('Failed to show history', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la récupération de l\'historique');
    }
  }

  async handleHistoryAction(phoneNumber: string, input: string): Promise<void> {
    try {
      const option = ValidationUtils.parseMenuOption(input);
      
      switch (option) {
        case 1:
          await this.showMoreTrips(phoneNumber);
          break;
          
        case 2:
          await this.rebookLastTrip(phoneNumber);
          break;
          
        case 0:
          await this.returnToMenu(phoneNumber);
          break;
          
        default:
          const message = MessageFormatter.formatInvalidInput();
          await this.whatsappService.sendMessage(phoneNumber, message);
      }
    } catch (error) {
      logger.error('Failed to handle history action', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'action sur l\'historique');
    }
  }

  private async showMoreTrips(phoneNumber: string): Promise<void> {
    try {
      const customer = await this.getCustomerByPhone(phoneNumber);
      
      if (!customer) {
        await this.returnToMenu(phoneNumber);
        return;
      }

      // Get more trips (offset by 5 to get the next batch)
      const moreTrips = await this.getCustomerTrips(customer.id);
      
      if (moreTrips.length === 0) {
        const message = `📚 *Historique complet*

Vous avez vu tous vos trajets.

*1* - Faire une nouvelle réservation
*0* - Retour menu principal`;
        
        await this.whatsappService.sendMessage(phoneNumber, message);
        return;
      }

      let message = `📚 *Historique (suite)*\n\n`;
      
      moreTrips.forEach((trip) => {
        const date = new Date(trip.createdAt).toLocaleDateString('fr-FR');
        const rating = trip.driverRating ? `⭐ ${trip.driverRating.toFixed(1)}` : 'Non noté';
        
        message += `🚗 **${date}** - ${trip.booking.pickupAddress} → ${trip.booking.dropAddress}\n`;
        message += `   Chauffeur : ${trip.driver.name} ${rating}\n`;
        message += `   Tarif : ${trip.fare} KMF\n\n`;
      });

      message += `*1* - Voir encore plus\n`;
      message += `*2* - Refaire une réservation\n`;
      message += `*0* - Retour menu principal`;

      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('More trips shown', {
        phoneNumber: this.maskPhone(phoneNumber),
        additionalTrips: moreTrips.length
      });
    } catch (error) {
      logger.error('Failed to show more trips', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors du chargement des trajets supplémentaires');
    }
  }

  private async rebookLastTrip(phoneNumber: string): Promise<void> {
    try {
      const customer = await this.getCustomerByPhone(phoneNumber);
      
      if (!customer) {
        await this.returnToMenu(phoneNumber);
        return;
      }

      const trips = await this.getCustomerTrips(customer.id);
      
      if (trips.length === 0) {
        const message = `❌ Aucun trajet à refaire.

*1* - Faire une nouvelle réservation
*0* - Retour menu principal`;
        
        await this.whatsappService.sendMessage(phoneNumber, message);
        return;
      }

      const lastTrip = trips[0];
      
      // Pre-fill booking data with last trip details
      await this.sessionManager.setConversationData(phoneNumber, {
        pickupAddress: lastTrip.booking.pickupAddress,
        dropAddress: lastTrip.booking.dropAddress,
        passengers: lastTrip.booking.passengers,
        estimatedFare: lastTrip.fare
      });
      
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_TIME);
      
      const message = `🔄 *Refaire le trajet*

📍 **Départ :** ${lastTrip.booking.pickupAddress}
🎯 **Arrivée :** ${lastTrip.booking.dropAddress}
👥 **Passagers :** ${lastTrip.booking.passengers}

${MessageFormatter.formatBookingTime()}`;
      
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Last trip rebook initiated', {
        phoneNumber: this.maskPhone(phoneNumber),
        originalTripId: lastTrip.id
      });
    } catch (error) {
      logger.error('Failed to rebook last trip', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la réservation du dernier trajet');
    }
  }

  private async returnToMenu(phoneNumber: string): Promise<void> {
    await this.sessionManager.resetSession(phoneNumber);
    
    const customer = await this.getCustomerByPhone(phoneNumber);
    const customerName = customer?.name || undefined;
    
    const message = MessageFormatter.formatWelcomeMenu(customerName);
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Returned to menu from history', {
      phoneNumber: this.maskPhone(phoneNumber)
    });
  }

  private async getCustomerByPhone(phoneNumber: string): Promise<any> {
    try {
      return await AuthService.findUserByPhone(phoneNumber);
    } catch (error) {
      logger.debug('Customer not found', {
        phoneNumber: this.maskPhone(phoneNumber)
      });
      return null;
    }
  }

  private async getCustomerTrips(customerId: string): Promise<any[]> {
    try {
      // Placeholder - implement getCustomerTrips in BookingService
      return [];
    } catch (error) {
      logger.error('Failed to get customer trips', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    const message = MessageFormatter.formatErrorMessage(errorMessage);
    await this.whatsappService.sendMessage(phoneNumber, message);
    await this.sessionManager.resetSession(phoneNumber);
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4 ? 
      phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX' : 
      'XXXX';
  }
}
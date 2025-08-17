import { ConversationState } from '../states/state.types';
import { SessionManager } from '../states/session.manager';
import { MessageFormatter } from '../utils/message.formatter';
import { ValidationUtils } from '../utils/validation.utils';
import { WhatsAppService } from '../services/whatsapp.service';
import logger from '@config/logger';
import prisma from '@config/database';

// Import existing services
import { BookingService } from '@services/booking.service';
import { AuthService } from '@services/auth.service';

export class BookingFlow {
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.sessionManager = SessionManager.getInstance();
    this.whatsappService = whatsappService;
  }

  async handleBookingStart(phoneNumber: string): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_START);
      
      const message = MessageFormatter.formatBookingStart();
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Booking flow started', { 
        phoneNumber: this.maskPhone(phoneNumber) 
      });
    } catch (error) {
      logger.error('Failed to start booking flow', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors du démarrage de la réservation');
    }
  }

  async handlePickupAddress(phoneNumber: string, address: string): Promise<void> {
    try {
      if (!ValidationUtils.isValidAddress(address)) {
        const message = `❌ Adresse invalide. L'adresse doit contenir au moins 5 caractères.\n\n${MessageFormatter.formatBookingStart()}`;
        await this.whatsappService.sendMessage(phoneNumber, message);
        return;
      }

      const sanitizedAddress = ValidationUtils.sanitizeAddress(address);
      
      await this.sessionManager.setConversationData(phoneNumber, {
        pickupAddress: sanitizedAddress
      });
      
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_DROP);
      
      const message = MessageFormatter.formatBookingDrop(sanitizedAddress);
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Pickup address set', {
        phoneNumber: this.maskPhone(phoneNumber),
        zone: ValidationUtils.extractZoneFromAddress(sanitizedAddress)
      });
    } catch (error) {
      logger.error('Failed to handle pickup address', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'enregistrement de l\'adresse');
    }
  }

  async handleDropAddress(phoneNumber: string, address: string): Promise<void> {
    try {
      if (!ValidationUtils.isValidAddress(address)) {
        const session = await this.sessionManager.getSession(phoneNumber);
        const pickupAddress = session.conversationData.pickupAddress || '';
        
        const message = `❌ Destination invalide. L'adresse doit contenir au moins 5 caractères.\n\n${MessageFormatter.formatBookingDrop(pickupAddress)}`;
        await this.whatsappService.sendMessage(phoneNumber, message);
        return;
      }

      const sanitizedAddress = ValidationUtils.sanitizeAddress(address);
      
      await this.sessionManager.setConversationData(phoneNumber, {
        dropAddress: sanitizedAddress
      });
      
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_TIME);
      
      const message = MessageFormatter.formatBookingTime();
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Drop address set', {
        phoneNumber: this.maskPhone(phoneNumber),
        zone: ValidationUtils.extractZoneFromAddress(sanitizedAddress)
      });
    } catch (error) {
      logger.error('Failed to handle drop address', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'enregistrement de la destination');
    }
  }

  async handleTimeSelection(phoneNumber: string, input: string): Promise<void> {
    try {
      let pickupTime: Date;
      
      if (ValidationUtils.isTimeOption(input)) {
        const option = parseInt(input);
        
        if (option === 4) {
          // Ask for custom time
          const message = `🕐 Précisez votre horaire souhaité :

_Exemples :_
• "14h30" ou "14:30"
• "dans 2 heures"
• "dans 45 minutes"

Format 24h accepté (ex: 18h45)`;
          
          await this.whatsappService.sendMessage(phoneNumber, message);
          return;
        } else {
          pickupTime = ValidationUtils.getTimeFromOption(option);
        }
      } else {
        // Try to parse custom time
        const customTime = ValidationUtils.parseCustomTime(input);
        
        if (!customTime) {
          const message = `❌ Horaire non reconnu.\n\n${MessageFormatter.formatBookingTime()}`;
          await this.whatsappService.sendMessage(phoneNumber, message);
          return;
        }
        
        pickupTime = customTime;
      }

      // Validate pickup time is not in the past
      if (pickupTime < new Date()) {
        const message = `❌ L'horaire ne peut pas être dans le passé.\n\n${MessageFormatter.formatBookingTime()}`;
        await this.whatsappService.sendMessage(phoneNumber, message);
        return;
      }

      await this.sessionManager.setConversationData(phoneNumber, {
        pickupTime
      });
      
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_CONFIRM);
      
      // Calculate estimated fare (simplified for now)
      const session = await this.sessionManager.getSession(phoneNumber);
      const estimatedFare = this.calculateEstimatedFare(
        session.conversationData.pickupAddress || '',
        session.conversationData.dropAddress || ''
      );
      
      await this.sessionManager.setConversationData(phoneNumber, {
        estimatedFare
      });
      
      const message = MessageFormatter.formatBookingConfirm(session.conversationData);
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Pickup time set', {
        phoneNumber: this.maskPhone(phoneNumber),
        pickupTime: pickupTime.toISOString()
      });
    } catch (error) {
      logger.error('Failed to handle time selection', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la sélection de l\'horaire');
    }
  }

  async handleBookingConfirmation(phoneNumber: string, input: string): Promise<void> {
    try {
      const option = ValidationUtils.parseMenuOption(input);
      
      switch (option) {
        case 1: // Confirm booking
          await this.confirmBooking(phoneNumber);
          break;
          
        case 2: // Modify details
          await this.handleBookingModification(phoneNumber);
          break;
          
        case 0: // Cancel
          await this.cancelBooking(phoneNumber);
          break;
          
        default:
          const session = await this.sessionManager.getSession(phoneNumber);
          const message = `❌ Option invalide.\n\n${MessageFormatter.formatBookingConfirm(session.conversationData)}`;
          await this.whatsappService.sendMessage(phoneNumber, message);
      }
    } catch (error) {
      logger.error('Failed to handle booking confirmation', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la confirmation');
    }
  }

  private async confirmBooking(phoneNumber: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      const data = session.conversationData;
      
      // Get or create customer
      const customer = await this.getOrCreateCustomer(phoneNumber);
      
      // Create booking via existing API
      const booking = await BookingService.createBooking(customer.id, {
        pickupAddress: data.pickupAddress!,
        dropAddress: data.dropAddress!,
        pickupTime: data.pickupTime!.toISOString(),
        passengers: data.passengers || 1,
        notes: undefined
      });
      
      await this.sessionManager.setConversationData(phoneNumber, {
        currentBookingId: booking.id
      });
      
      await this.sessionManager.setState(phoneNumber, ConversationState.BOOKING_WAITING);
      
      const message = MessageFormatter.formatBookingWaiting();
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      // Start driver matching process
      await this.startDriverMatching(phoneNumber, booking.id);
      
      logger.info('Booking confirmed and created', {
        phoneNumber: this.maskPhone(phoneNumber),
        bookingId: booking.id
      });
    } catch (error) {
      logger.error('Failed to confirm booking', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleApiError(phoneNumber);
    }
  }

  private async handleBookingModification(phoneNumber: string): Promise<void> {
    const message = `✏️ *Modifier la réservation*

Que souhaitez-vous modifier ?

*1* - Adresse de départ
*2* - Destination  
*3* - Horaire
*0* - Retour à la confirmation`;

    await this.whatsappService.sendMessage(phoneNumber, message);
    
    // Set a temporary state to handle modification
    await this.sessionManager.setConversationData(phoneNumber, {
      modificationMode: true
    });
  }

  private async cancelBooking(phoneNumber: string): Promise<void> {
    await this.sessionManager.resetSession(phoneNumber);
    
    const message = `❌ *Réservation annulée*

Aucun souci ! Vous pouvez faire une nouvelle réservation quand vous voulez.

${MessageFormatter.formatWelcomeMenu()}`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    logger.info('Booking cancelled by user', {
      phoneNumber: this.maskPhone(phoneNumber)
    });
  }

  private async startDriverMatching(phoneNumber: string, bookingId: string): Promise<void> {
    // This would typically involve:
    // 1. Finding available drivers in the area
    // 2. Sending booking notifications to drivers
    // 3. Waiting for driver acceptance
    // 4. Updating booking status
    
    // For now, simulate the process
    setTimeout(async () => {
      try {
        // Simulate driver found (in real implementation, this would be event-driven)
        const message = MessageFormatter.formatDriverFound(
          'Ahmed Mohamed',
          'Toyota Corolla - KM 123 AB',
          4.8
        );
        
        await this.whatsappService.sendMessage(phoneNumber, message);
        await this.sessionManager.resetSession(phoneNumber);
        
        logger.info('Driver found and assigned', {
          phoneNumber: this.maskPhone(phoneNumber),
          bookingId
        });
      } catch (error) {
        logger.error('Failed to notify driver found', {
          phoneNumber: this.maskPhone(phoneNumber),
          bookingId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, 15000); // Simulate 15 second wait
  }

  private async getOrCreateCustomer(phoneNumber: string): Promise<any> {
    try {
      // Try to authenticate existing customer
      const customer = await AuthService.findUserByPhone(phoneNumber);
      
      if (customer) {
        return customer;
      }
      
      // Create new customer
      // Create new customer (placeholder - implement createCustomer in AuthService)
      return await prisma.customer.create({
        data: {
          phoneNumber,
          name: `Client ${phoneNumber.slice(-4)}` // Temporary name
        }
      });
    } catch (error) {
      logger.error('Failed to get or create customer', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private calculateEstimatedFare(pickupAddress: string, dropAddress: string): number {
    // Simplified fare calculation based on zones
    const pickupZone = ValidationUtils.extractZoneFromAddress(pickupAddress);
    const dropZone = ValidationUtils.extractZoneFromAddress(dropAddress);
    
    // Base fare
    let fare = 1000; // 1000 KMF base
    
    // Add distance-based pricing
    if (pickupZone !== dropZone) {
      fare += 500; // Inter-zone surcharge
    }
    
    // Airport surcharge
    if (pickupAddress.toLowerCase().includes('aéroport') || 
        dropAddress.toLowerCase().includes('aéroport')) {
      fare += 1000;
    }
    
    return fare;
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    const message = MessageFormatter.formatErrorMessage(errorMessage);
    await this.whatsappService.sendMessage(phoneNumber, message);
    await this.sessionManager.resetSession(phoneNumber);
  }

  private async handleApiError(phoneNumber: string): Promise<void> {
    const message = MessageFormatter.formatApiError();
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4 ? 
      phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX' : 
      'XXXX';
  }
}
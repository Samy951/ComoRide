import { ConversationState } from '../states/state.types';
import { SessionManager } from '../states/session.manager';
import { WhatsAppService } from '../services/whatsapp.service';
import { PhoneUtils } from '../utils/phone.utils';
import { ValidationUtils } from '../utils/validation.utils';
import { DriverService } from '../../services/driver.service';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger';

const prisma = new PrismaClient();

export class DriverFlow {
  private sessionManager: SessionManager;
  private whatsappService: WhatsAppService;

  constructor(whatsappService: WhatsAppService) {
    this.whatsappService = whatsappService;
    this.sessionManager = SessionManager.getInstance();
  }

  async handleDriverMenu(phoneNumber: string, driverName?: string): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.DRIVER_MENU);
      
      // Get driver status
      const driver = await prisma.driver.findUnique({
        where: { phoneNumber },
        select: {
          name: true,
          isAvailable: true,
          isOnline: true,
          isVerified: true
        }
      });

      if (!driver) {
        await this.handleDriverNotFound(phoneNumber);
        return;
      }

      if (!driver.isVerified) {
        await this.handleDriverNotVerified(phoneNumber);
        return;
      }

      const statusText = driver.isAvailable ? '🟢 DISPONIBLE' : '🔴 OCCUPÉ';
      const name = driverName || driver.name;

      const message = `🚗 *MENU CHAUFFEUR*

Salut ${name} ! Que veux-tu faire ?

*1* - 🟢 Je suis disponible
*2* - 🔴 Je suis occupé  
*3* - 📋 Mes courses
*4* - 👤 Mode client (réserver)
*5* - ❓ Aide chauffeur

*0* - 🔄 Actualiser

Statut actuel: ${statusText}`;

      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Driver menu displayed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        driverName: name,
        status: statusText
      });
    } catch (error) {
      logger.error('Failed to show driver menu', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'affichage du menu');
    }
  }

  async handleMenuSelection(phoneNumber: string, input: string): Promise<void> {
    try {
      if (!ValidationUtils.isMenuOption(input)) {
        await this.handleInvalidInput(phoneNumber, input);
        return;
      }

      const option = ValidationUtils.parseMenuOption(input);
      
      switch (option) {
        case 1:
          await this.handleAvailabilityToggle(phoneNumber, true);
          break;
          
        case 2:
          await this.handleAvailabilityToggle(phoneNumber, false);
          break;
          
        case 3:
          await this.handleTripStatus(phoneNumber);
          break;
          
        case 4:
          await this.switchToClientMode(phoneNumber);
          break;
          
        case 5:
          await this.handleDriverHelp(phoneNumber);
          break;
          
        case 0:
          await this.handleDriverMenu(phoneNumber);
          break;
          
        default:
          await this.handleInvalidInput(phoneNumber, input);
      }
      
      logger.info('Driver menu selection processed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        selectedOption: option
      });
    } catch (error) {
      logger.error('Failed to handle driver menu selection', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la sélection du menu');
    }
  }

  async handleAvailabilityToggle(phoneNumber: string, isAvailable: boolean): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.DRIVER_AVAILABILITY);
      
      // Update driver availability
      const driver = await prisma.driver.findUnique({
        where: { phoneNumber },
        select: { id: true }
      });

      if (!driver) {
        await this.handleDriverNotFound(phoneNumber);
        return;
      }

      await DriverService.updateAvailability(driver.id, {
        isAvailable,
        isOnline: isAvailable,
        zones: undefined
      });

      // Increment toggle count
      const session = await this.sessionManager.getSession(phoneNumber);
      const toggleCount = (session.conversationData.availabilityToggleCount || 0) + 1;
      
      await this.sessionManager.setConversationData(phoneNumber, {
        availabilityToggleCount: toggleCount
      });

      const statusMessage = isAvailable 
        ? '✅ Vous êtes maintenant DISPONIBLE pour recevoir des courses'
        : '🔴 Vous êtes maintenant OCCUPÉ. Vous ne recevrez plus de notifications';

      await this.whatsappService.sendMessage(phoneNumber, statusMessage);
      
      // Return to menu after 2 seconds
      setTimeout(async () => {
        await this.handleDriverMenu(phoneNumber);
      }, 2000);
      
      logger.info('Driver availability updated', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        isAvailable,
        toggleCount
      });
    } catch (error) {
      logger.error('Failed to update driver availability', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        isAvailable,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la mise à jour de disponibilité');
    }
  }

  async handleTripStatus(phoneNumber: string): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.DRIVER_TRIP_STATUS);
      
      const driver = await prisma.driver.findUnique({
        where: { phoneNumber },
        include: {
          bookings: {
            where: {
              status: { in: ['ACCEPTED', 'PENDING'] }
            },
            include: {
              customer: { select: { name: true } }
            },
            orderBy: { pickupTime: 'asc' }
          },
          trips: {
            where: {
              startTime: {
                gte: new Date(new Date().setHours(0, 0, 0, 0))
              }
            },
            include: {
              customer: { select: { name: true } }
            },
            orderBy: { startTime: 'desc' },
            take: 5
          }
        }
      });

      if (!driver) {
        await this.handleDriverNotFound(phoneNumber);
        return;
      }

      const ongoingBookings = driver.bookings.filter(b => b.status === 'ACCEPTED');
      const completedTrips = driver.trips.filter(t => t.endTime !== null);

      let message = '📋 *MES COURSES*\n\n';

      // Ongoing trips
      if (ongoingBookings.length > 0) {
        message += `🔄 **En cours** (${ongoingBookings.length})\n`;
        ongoingBookings.forEach(booking => {
          const time = booking.pickupTime.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          message += `- ${booking.pickupAddress} → ${booking.dropAddress} (${time})\n`;
        });
        message += '\n';
      }

      // Completed trips today
      if (completedTrips.length > 0) {
        message += `✅ **Terminées aujourd'hui** (${completedTrips.length})\n`;
        completedTrips.forEach(trip => {
          const time = trip.startTime.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          const rating = trip.customerRating ? `⭐${trip.customerRating}` : '⭐-';
          message += `- ${trip.customer.name} (${time}) - ${trip.fare} KMF ${rating}\n`;
        });
        message += '\n';
      }

      if (ongoingBookings.length === 0 && completedTrips.length === 0) {
        message += '📭 Aucune course aujourd\'hui\n\n';
      }

      message += `*1* - Voir détails course en cours
*2* - Historique complet  
*0* - Retour menu`;

      await this.whatsappService.sendMessage(phoneNumber, message);
      
      logger.info('Driver trip status displayed', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        ongoingTrips: ongoingBookings.length,
        completedTrips: completedTrips.length
      });
    } catch (error) {
      logger.error('Failed to show driver trip status', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'affichage des courses');
    }
  }

  async handleTripStatusAction(phoneNumber: string, input: string): Promise<void> {
    try {
      if (!ValidationUtils.isMenuOption(input)) {
        await this.handleInvalidInput(phoneNumber, input);
        return;
      }

      const option = ValidationUtils.parseMenuOption(input);
      
      switch (option) {
        case 1:
          await this.showOngoingTripDetails(phoneNumber);
          break;
          
        case 2:
          await this.showTripHistory(phoneNumber);
          break;
          
        case 0:
          await this.handleDriverMenu(phoneNumber);
          break;
          
        default:
          await this.handleInvalidInput(phoneNumber, input);
      }
    } catch (error) {
      logger.error('Failed to handle trip status action', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        input,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'action sur les courses');
    }
  }

  async switchToClientMode(phoneNumber: string): Promise<void> {
    try {
      // Mark as temporary client mode
      await this.sessionManager.setConversationData(phoneNumber, {
        isDriverMode: false,
        temporaryClientMode: true
      });
      
      // Import MenuHandler dynamically to avoid circular dependency
      const { MenuHandler } = await import('../handlers/menu.handler');
      const menuHandler = new MenuHandler(this.whatsappService);
      
      const message = `🔄 *MODE CLIENT ACTIVÉ*

Vous pouvez maintenant réserver comme un client :`;
      
      await menuHandler.showMainMenu(phoneNumber, message);
      
      logger.info('Driver switched to client mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber)
      });
    } catch (error) {
      logger.error('Failed to switch to client mode', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors du basculement en mode client');
    }
  }

  async handleBookingNotification(phoneNumber: string, booking: any): Promise<void> {
    try {
      await this.sessionManager.setState(phoneNumber, ConversationState.DRIVER_BOOKING_NOTIFY);
      
      // Set booking notification data
      await this.sessionManager.setConversationData(phoneNumber, {
        currentBookingNotification: booking.id,
        bookingNotificationTimeout: new Date(Date.now() + 30000) // 30 seconds
      });

      const pickupTime = new Date(booking.pickupTime).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = `🔔 *NOUVELLE COURSE DISPONIBLE*

📍 **Départ**: ${booking.pickupAddress}
🎯 **Arrivée**: ${booking.dropAddress}  
⏰ **Heure**: ${pickupTime}
👥 **Passagers**: ${booking.passengers}
💰 **Tarif estimé**: ${booking.estimatedFare} KMF

🚗 Réponds rapidement :
*OUI* - Accepter la course
*NON* - Refuser

⏱️ Tu as 30 secondes pour répondre`;

      await this.whatsappService.sendMessage(phoneNumber, message);
      
      // Set timeout for booking notification
      setTimeout(async () => {
        await this.handleBookingTimeout(phoneNumber, booking.id);
      }, 30000);
      
      logger.info('Booking notification sent to driver', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId: booking.id
      });
    } catch (error) {
      logger.error('Failed to send booking notification', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId: booking.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async handleBookingResponse(phoneNumber: string, response: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      const bookingId = session.conversationData.currentBookingNotification;
      
      if (!bookingId) {
        await this.handleDriverMenu(phoneNumber);
        return;
      }

      await this.sessionManager.setState(phoneNumber, ConversationState.DRIVER_BOOKING_ACCEPT);
      
      const lowerResponse = response.toLowerCase().trim();
      const isAccepting = lowerResponse === 'oui' || lowerResponse === '1' || 
                         ValidationUtils.isYesOption(response);
      const isRefusing = lowerResponse === 'non' || lowerResponse === '2' || 
                        ValidationUtils.isNoOption(response);
      
      if (isAccepting) {
        await this.handleBookingAcceptance(phoneNumber, bookingId);
      } else if (isRefusing) {
        await this.handleBookingRefusal(phoneNumber, bookingId);
      } else {
        // Invalid response, ask again
        const message = `⚠️ Réponse non comprise. Réponds par :
*OUI* - Accepter la course
*NON* - Refuser la course`;
        
        await this.whatsappService.sendMessage(phoneNumber, message);
      }
    } catch (error) {
      logger.error('Failed to handle booking response', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        response,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de la réponse à la course');
    }
  }

  private async handleBookingAcceptance(phoneNumber: string, bookingId: string): Promise<void> {
    try {
      // Get driver and booking
      const driver = await prisma.driver.findUnique({
        where: { phoneNumber },
        select: { id: true, name: true }
      });

      if (!driver) {
        await this.handleDriverNotFound(phoneNumber);
        return;
      }

      // Check if booking is still available
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: { select: { name: true, phoneNumber: true } } }
      });

      if (!booking || booking.status !== 'PENDING') {
        const message = `⚠️ *COURSE DÉJÀ ASSIGNÉE*
Cette course a été acceptée par un autre chauffeur.
Retour au menu...`;
        
        await this.whatsappService.sendMessage(phoneNumber, message);
        await this.resetToDriverMenu(phoneNumber);
        return;
      }

      // Assign booking to driver
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          driverId: driver.id,
          status: 'ACCEPTED'
        }
      });

      // Send confirmation to driver
      const pickupTime = booking.pickupTime.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      const confirmMessage = `✅ *COURSE CONFIRMÉE*

👤 **Client**: ${booking.customer.name}
📞 **Téléphone**: ${booking.customer.phoneNumber}
📍 **Récupération**: ${booking.pickupAddress}
🎯 **Destination**: ${booking.dropAddress}
⏰ **Heure prévue**: ${pickupTime}
💰 **Tarif**: ${booking.estimatedFare} KMF

*1* - Contacter client
*2* - Course terminée
*3* - Problème/Annulation
*0* - Retour menu`;

      await this.whatsappService.sendMessage(phoneNumber, confirmMessage);
      
      // Notify customer that driver is assigned
      const customerMessage = `✅ *CHAUFFEUR TROUVÉ !*

🚗 **Chauffeur**: ${driver.name}
📞 **Contact**: ${phoneNumber}
⏰ **Pickup**: ${pickupTime}

Votre chauffeur vous contactera bientôt !`;
      
      await this.whatsappService.sendMessage(booking.customer.phoneNumber, customerMessage);
      
      await this.resetToDriverMenu(phoneNumber);
      
      logger.info('Booking accepted by driver', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId,
        driverName: driver.name
      });
    } catch (error) {
      logger.error('Failed to handle booking acceptance', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await this.handleError(phoneNumber, 'Erreur lors de l\'acceptation de la course');
    }
  }

  private async handleBookingRefusal(phoneNumber: string, bookingId: string): Promise<void> {
    try {
      const message = `❌ Course refusée`;
      await this.whatsappService.sendMessage(phoneNumber, message);
      
      await this.resetToDriverMenu(phoneNumber);
      
      logger.info('Booking refused by driver', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId
      });
    } catch (error) {
      logger.error('Failed to handle booking refusal', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleBookingTimeout(phoneNumber: string, bookingId: string): Promise<void> {
    try {
      const session = await this.sessionManager.getSession(phoneNumber);
      
      // Check if still waiting for response to this booking
      if (session.conversationData.currentBookingNotification === bookingId &&
          session.currentState === ConversationState.DRIVER_BOOKING_NOTIFY) {
        
        const message = `⏰ Délai dépassé, course proposée à d'autres chauffeurs`;
        await this.whatsappService.sendMessage(phoneNumber, message);
        
        await this.resetToDriverMenu(phoneNumber);
        
        logger.info('Booking notification timeout', {
          phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
          bookingId
        });
      }
    } catch (error) {
      logger.error('Failed to handle booking timeout', {
        phoneNumber: PhoneUtils.maskPhoneNumber(phoneNumber),
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async showOngoingTripDetails(phoneNumber: string): Promise<void> {
    // Implementation for showing detailed ongoing trip info
    const message = `🚗 *COURSE EN COURS*

Détails de la course en cours...

*0* - Retour menu`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async showTripHistory(phoneNumber: string): Promise<void> {
    // Implementation for showing trip history
    const message = `📚 *HISTORIQUE COMPLET*

Historique des courses...

*0* - Retour menu`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async handleDriverHelp(phoneNumber: string): Promise<void> {
    const message = `❓ *AIDE CHAUFFEUR*

🚗 **Disponibilité**
- Activez pour recevoir des courses
- Désactivez quand vous n'êtes pas disponible

🔔 **Notifications**
- Vous avez 30s pour répondre
- Répondez OUI ou NON uniquement

📋 **Courses**
- Consultez vos courses en cours
- Voir l'historique des trajets

👤 **Mode Client**
- Vous pouvez aussi réserver des courses
- Retour automatique en mode chauffeur

*0* - Retour menu`;

    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async handleDriverNotFound(phoneNumber: string): Promise<void> {
    const message = `❌ *CHAUFFEUR NON TROUVÉ*
Aucun compte chauffeur trouvé pour ce numéro.
Contactez l'administration : +269 XXX XXXX`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async handleDriverNotVerified(phoneNumber: string): Promise<void> {
    const message = `❌ *ACCÈS REFUSÉ*
Votre compte chauffeur n'est pas encore vérifié.
Contactez l'administration : +269 XXX XXXX`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
  }

  private async handleInvalidInput(phoneNumber: string, input: string): Promise<void> {
    const message = `❌ Option non valide: "${input}"

Utilisez uniquement les numéros proposés dans le menu.`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    // Show menu again after 2 seconds
    setTimeout(async () => {
      await this.handleDriverMenu(phoneNumber);
    }, 2000);
  }

  private async handleError(phoneNumber: string, errorMessage: string): Promise<void> {
    const message = `🔧 *ERREUR TECHNIQUE*
${errorMessage}
Réessayez dans quelques instants.
Support : +269 XXX XXXX`;
    
    await this.whatsappService.sendMessage(phoneNumber, message);
    
    await this.resetToDriverMenu(phoneNumber);
  }

  private async resetToDriverMenu(phoneNumber: string): Promise<void> {
    await this.sessionManager.setConversationData(phoneNumber, {
      currentBookingNotification: null,
      bookingNotificationTimeout: null,
      isDriverMode: true,
      temporaryClientMode: false
    });
    
    setTimeout(async () => {
      await this.handleDriverMenu(phoneNumber);
    }, 2000);
  }
}
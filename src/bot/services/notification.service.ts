import { WhatsAppService } from './whatsapp.service';
import { MessageFormatter } from '../utils/message.formatter';
import logger from '../../config/logger';

export class NotificationService {
  private static instance: NotificationService;
  private whatsappService!: WhatsAppService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  setWhatsAppService(whatsappService: WhatsAppService): void {
    this.whatsappService = whatsappService;
  }

  async notifyDriverFound(phoneNumber: string, driverInfo: {
    name: string;
    vehicleInfo: string;
    rating: number;
    phone?: string;
    estimatedArrival?: number;
  }): Promise<void> {
    try {
      const message = MessageFormatter.formatDriverFound(
        driverInfo.name,
        driverInfo.vehicleInfo,
        driverInfo.rating
      );

      await this.whatsappService.sendMessage(phoneNumber, message);

      // If driver phone is provided, send additional contact info
      if (driverInfo.phone) {
        const contactMessage = `📞 **Contact chauffeur**

${driverInfo.name} : ${driverInfo.phone}

Le chauffeur vous contactera dans 2-3 minutes pour confirmer le point de rencontre.`;

        // Send after a short delay
        setTimeout(async () => {
          await this.whatsappService.sendMessage(phoneNumber, contactMessage);
        }, 3000);
      }

      logger.info('Driver found notification sent', {
        customer: this.maskPhone(phoneNumber),
        driver: driverInfo.name
      });
    } catch (error) {
      logger.error('Failed to send driver found notification', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async notifyBookingCancelled(phoneNumber: string, reason: string): Promise<void> {
    try {
      const message = `❌ *Réservation annulée*

Raison : ${reason}

Vous pouvez faire une nouvelle réservation quand vous voulez.

Tapez *1* pour réserver ou *MENU* pour le menu principal.`;

      await this.whatsappService.sendMessage(phoneNumber, message);

      logger.info('Booking cancellation notification sent', {
        phoneNumber: this.maskPhone(phoneNumber),
        reason
      });
    } catch (error) {
      logger.error('Failed to send booking cancellation notification', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async notifyTripStarted(phoneNumber: string, tripInfo: {
    driverName: string;
    vehicleInfo: string;
    estimatedDuration?: number;
    estimatedFare?: number;
  }): Promise<void> {
    try {
      const durationStr = tripInfo.estimatedDuration ? 
        `${Math.round(tripInfo.estimatedDuration)} minutes` : 
        'À confirmer';

      const fareStr = tripInfo.estimatedFare ? 
        `${tripInfo.estimatedFare} KMF` : 
        'À confirmer';

      const message = `🚗 *Trajet commencé*

👨‍💼 Chauffeur : ${tripInfo.driverName}
🚙 Véhicule : ${tripInfo.vehicleInfo}
⏱️ Durée estimée : ${durationStr}
💰 Tarif estimé : ${fareStr}

Bon voyage avec Como Ride ! 🌟

_Vous pourrez évaluer votre chauffeur à la fin du trajet._`;

      await this.whatsappService.sendMessage(phoneNumber, message);

      logger.info('Trip started notification sent', {
        customer: this.maskPhone(phoneNumber),
        driver: tripInfo.driverName
      });
    } catch (error) {
      logger.error('Failed to send trip started notification', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async notifyTripCompleted(phoneNumber: string, tripInfo: {
    driverName: string;
    finalFare: number;
    duration: number;
    distance?: number;
  }): Promise<void> {
    try {
      const distanceStr = tripInfo.distance ? 
        `${tripInfo.distance.toFixed(1)} km` : 
        'Non mesurée';

      const durationStr = `${Math.round(tripInfo.duration)} minutes`;

      const message = `✅ *Trajet terminé*

👨‍💼 Chauffeur : ${tripInfo.driverName}
⏱️ Durée : ${durationStr}
📏 Distance : ${distanceStr}
💰 **Tarif final : ${tripInfo.finalFare} KMF**

Merci d'avoir voyagé avec Como Ride ! 🙏

⭐ **Évaluez votre chauffeur :**
Tapez une note de 1 à 5 étoiles
_Exemple : "5" pour excellent service_

Votre avis nous aide à améliorer notre service.`;

      await this.whatsappService.sendMessage(phoneNumber, message);

      logger.info('Trip completed notification sent', {
        customer: this.maskPhone(phoneNumber),
        driver: tripInfo.driverName,
        fare: tripInfo.finalFare
      });
    } catch (error) {
      logger.error('Failed to send trip completed notification', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async notifyPaymentReminder(phoneNumber: string, amount: number, driverName: string): Promise<void> {
    try {
      const message = `💳 *Rappel de paiement*

Montant à régler : **${amount} KMF**
Chauffeur : ${driverName}

💵 Paiement en espèces directement au chauffeur
📱 Orange Money bientôt disponible

Merci de régler avant de quitter le véhicule.`;

      await this.whatsappService.sendMessage(phoneNumber, message);

      logger.info('Payment reminder sent', {
        customer: this.maskPhone(phoneNumber),
        amount
      });
    } catch (error) {
      logger.error('Failed to send payment reminder', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async notifyServiceUpdate(phoneNumber: string, updateType: 'maintenance' | 'feature' | 'general', message: string): Promise<void> {
    try {
      let icon: string;
      let title: string;

      switch (updateType) {
        case 'maintenance':
          icon = '🔧';
          title = 'Maintenance programmée';
          break;
        case 'feature':
          icon = '🆕';
          title = 'Nouvelle fonctionnalité';
          break;
        case 'general':
        default:
          icon = '📢';
          title = 'Information importante';
          break;
      }

      const formattedMessage = `${icon} *${title}*

${message}

---
L'équipe Como Ride 🚗`;

      await this.whatsappService.sendMessage(phoneNumber, formattedMessage);

      logger.info('Service update notification sent', {
        phoneNumber: this.maskPhone(phoneNumber),
        updateType
      });
    } catch (error) {
      logger.error('Failed to send service update notification', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async notifyPromotion(phoneNumber: string, promoInfo: {
    title: string;
    description: string;
    code?: string;
    validUntil?: Date;
  }): Promise<void> {
    try {
      let message = `🎉 *${promoInfo.title}*

${promoInfo.description}`;

      if (promoInfo.code) {
        message += `\n\n🎫 **Code promo :** ${promoInfo.code}`;
      }

      if (promoInfo.validUntil) {
        const dateStr = promoInfo.validUntil.toLocaleDateString('fr-FR');
        message += `\n⏰ Valable jusqu'au ${dateStr}`;
      }

      message += `\n\n📱 Utilisez ce code lors de votre prochaine réservation !`;

      await this.whatsappService.sendMessage(phoneNumber, message);

      logger.info('Promotion notification sent', {
        phoneNumber: this.maskPhone(phoneNumber),
        promoTitle: promoInfo.title
      });
    } catch (error) {
      logger.error('Failed to send promotion notification', {
        phoneNumber: this.maskPhone(phoneNumber),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendBulkNotification(phoneNumbers: string[], message: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const phoneNumber of phoneNumbers) {
      try {
        await this.whatsappService.sendMessage(phoneNumber, message);
        results.success++;
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.failed++;
        results.errors.push(`${this.maskPhone(phoneNumber)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    logger.info('Bulk notification completed', {
      totalRecipients: phoneNumbers.length,
      successful: results.success,
      failed: results.failed
    });

    return results;
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.length > 4 ? 
      phoneNumber.substring(0, phoneNumber.length - 4) + 'XXXX' : 
      'XXXX';
  }
}
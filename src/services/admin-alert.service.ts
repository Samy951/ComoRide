import { PrismaClient } from '@prisma/client';
import { PhoneUtils } from '../bot/utils/phone.utils';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface CustomerInfo {
  name: string;
  phoneNumber: string;
  pickupAddress: string;
  dropAddress: string;
  pickupTime: Date;
}

export interface SystemError {
  type: 'MATCHING_FAILURE' | 'DATABASE_ERROR' | 'NOTIFICATION_FAILURE';
  message: string;
  details?: any;
  timestamp: Date;
}

export interface AdminAlertService {
  alertBookingTimeout(bookingId: string, customerInfo: CustomerInfo): Promise<void>;
  alertSystemError(error: SystemError): Promise<void>;
  alertLowDriverAvailability(zone: string, availableCount: number): Promise<void>;
  sendDailyMetricsReport(): Promise<void>;
}

export class AdminAlertServiceImpl implements AdminAlertService {
  private static instance: AdminAlertServiceImpl;
  private adminPhoneNumbers: string[] = [];

  constructor() {
    if (AdminAlertServiceImpl.instance) {
      return AdminAlertServiceImpl.instance;
    }
    AdminAlertServiceImpl.instance = this;
    
    // Configuration des numéros admin via variables d'environnement
    this.adminPhoneNumbers = (process.env.ADMIN_PHONE_NUMBERS || '+269XXXXXXX')
      .split(',')
      .map(phone => phone.trim());
  }

  static getInstance(): AdminAlertServiceImpl {
    if (!AdminAlertServiceImpl.instance) {
      AdminAlertServiceImpl.instance = new AdminAlertServiceImpl();
    }
    return AdminAlertServiceImpl.instance;
  }

  async alertBookingTimeout(bookingId: string, customerInfo: CustomerInfo): Promise<void> {
    try {
      logger.warn('Sending booking timeout alert to admin', {
        bookingId,
        customerPhone: PhoneUtils.maskPhoneNumber(customerInfo.phoneNumber),
        pickupAddress: customerInfo.pickupAddress
      });

      const pickupTime = customerInfo.pickupTime.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const alertMessage = `🚨 *ALERTE ADMIN - TIMEOUT*

❌ Aucun chauffeur trouvé après 5 minutes

📋 **Détails course:**
👤 Client: ${customerInfo.name}
📞 Téléphone: ${PhoneUtils.maskPhoneNumber(customerInfo.phoneNumber)}
📍 Départ: ${customerInfo.pickupAddress}
🎯 Arrivée: ${customerInfo.dropAddress}
⏰ Heure prévue: ${pickupTime}

🔍 **Actions suggérées:**
- Contacter client pour proposer horaire alternatif
- Vérifier disponibilité chauffeurs
- Analyser demande dans zone

ID Course: ${bookingId}
Heure alerte: ${new Date().toLocaleString('fr-FR')}`;

      await this.sendAlertToAdmins(alertMessage);

      // Logger l'alerte
      logger.warn('Booking timeout alert sent', {
        bookingId,
        adminCount: this.adminPhoneNumbers.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to send booking timeout alert', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async alertSystemError(error: SystemError): Promise<void> {
    try {
      logger.error('Sending system error alert to admin', {
        errorType: error.type,
        message: error.message,
        timestamp: error.timestamp
      });

      const alertMessage = `🔥 *ALERTE SYSTÈME - ERREUR*

⚠️ **Type d'erreur:** ${error.type}
📝 **Message:** ${error.message}
⏰ **Heure:** ${error.timestamp.toLocaleString('fr-FR')}

🔧 **Détails techniques:**
${error.details ? JSON.stringify(error.details, null, 2) : 'Aucun détail supplémentaire'}

🚨 **Action requise:** Vérification système immédiate
📞 **Support:** +269 XXX XXXX`;

      await this.sendAlertToAdmins(alertMessage);

      logger.error('System error alert sent', {
        errorType: error.type,
        adminCount: this.adminPhoneNumbers.length,
        timestamp: new Date().toISOString()
      });

    } catch (alertError) {
      logger.error('Failed to send system error alert', {
        originalError: error.message,
        alertError: alertError instanceof Error ? alertError.message : 'Unknown error'
      });
    }
  }

  async alertLowDriverAvailability(zone: string, availableCount: number): Promise<void> {
    try {
      logger.warn('Sending low driver availability alert', {
        zone,
        availableCount
      });

      const alertMessage = `⚠️ *ALERTE - DISPONIBILITÉ FAIBLE*

📍 **Zone:** ${zone}
🚗 **Chauffeurs disponibles:** ${availableCount}

🎯 **Actions recommandées:**
- Contacter chauffeurs inactifs de la zone
- Vérifier planning des chauffeurs
- Envisager incentives pour cette zone
- Surveiller demandes clients

⏰ Heure: ${new Date().toLocaleString('fr-FR')}`;

      await this.sendAlertToAdmins(alertMessage);

      logger.warn('Low driver availability alert sent', {
        zone,
        availableCount,
        adminCount: this.adminPhoneNumbers.length
      });

    } catch (error) {
      logger.error('Failed to send low driver availability alert', {
        zone,
        availableCount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendDailyMetricsReport(): Promise<void> {
    try {
      logger.info('Generating daily metrics report for admin');

      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      // Récupérer métriques du jour
      const [
        totalBookings,
        successfulMatches,
        timeoutBookings,
        averageDrivers,
        activeDrivers
      ] = await Promise.all([
        // Total bookings today
        prisma.booking.count({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        }),

        // Successful matches
        prisma.matchingMetrics.count({
          where: {
            finalStatus: 'MATCHED',
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        }),

        // Timeout bookings
        prisma.matchingMetrics.count({
          where: {
            finalStatus: 'TIMEOUT',
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          }
        }),

        // Average drivers notified
        prisma.matchingMetrics.aggregate({
          where: {
            createdAt: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          _avg: {
            totalDriversNotified: true
          }
        }),

        // Currently active drivers
        prisma.driver.count({
          where: {
            isAvailable: true,
            isOnline: true,
            isVerified: true,
            isActive: true
          }
        })
      ]);

      const successRate = totalBookings > 0 
        ? Math.round((successfulMatches / totalBookings) * 100) 
        : 0;

      const timeoutRate = totalBookings > 0 
        ? Math.round((timeoutBookings / totalBookings) * 100) 
        : 0;

      const avgDriversNotified = Math.round(averageDrivers._avg.totalDriversNotified || 0);

      const reportMessage = `📊 *RAPPORT QUOTIDIEN - ${today.toLocaleDateString('fr-FR')}*

📈 **Performances matching:**
🎯 Courses totales: ${totalBookings}
✅ Matches réussis: ${successfulMatches} (${successRate}%)
❌ Timeouts: ${timeoutBookings} (${timeoutRate}%)
📊 Taux de succès: ${successRate}%

🚗 **Chauffeurs:**
👥 Actuellement en ligne: ${activeDrivers}
📱 Moyenne notifiés/course: ${avgDriversNotified}

📋 **Recommandations:**
${successRate < 80 ? '⚠️ Taux de succès faible - Recruter plus de chauffeurs' : '✅ Taux de succès satisfaisant'}
${timeoutRate > 20 ? '⚠️ Trop de timeouts - Vérifier disponibilité chauffeurs' : '✅ Timeouts acceptables'}
${activeDrivers < 10 ? '⚠️ Peu de chauffeurs en ligne - Campagne d\'activation' : '✅ Bonne couverture chauffeurs'}

⏰ Généré le ${new Date().toLocaleString('fr-FR')}`;

      await this.sendAlertToAdmins(reportMessage);

      logger.info('Daily metrics report sent', {
        totalBookings,
        successfulMatches,
        timeoutBookings,
        successRate,
        activeDrivers,
        adminCount: this.adminPhoneNumbers.length
      });

    } catch (error) {
      logger.error('Failed to send daily metrics report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendAlertToAdmins(message: string): Promise<void> {
    try {
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');
      const whatsappService = WhatsAppService.getInstance();
      
      if (!whatsappService) {
        logger.error('WhatsApp service not available for admin alerts');
        return;
      }

      // Envoyer le message à tous les numéros admin
      const alertPromises = this.adminPhoneNumbers.map(phoneNumber =>
        whatsappService.sendMessage(phoneNumber, message)
      );

      const results = await Promise.allSettled(alertPromises);

      // Logger les résultats
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Admin alert broadcast completed', {
        successful,
        failed,
        totalAdmins: this.adminPhoneNumbers.length
      });

      if (failed > 0) {
        logger.warn('Some admin alerts failed to send', {
          failedCount: failed,
          errors: results
            .filter(r => r.status === 'rejected')
            .map(r => r.reason)
        });
      }

    } catch (error) {
      logger.error('Failed to broadcast alert to admins', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminCount: this.adminPhoneNumbers.length
      });
    }
  }

  // Méthodes utilitaires
  setAdminPhoneNumbers(phoneNumbers: string[]): void {
    this.adminPhoneNumbers = phoneNumbers;
    logger.info('Admin phone numbers updated', {
      count: phoneNumbers.length
    });
  }

  getAdminPhoneNumbers(): string[] {
    return this.adminPhoneNumbers.map(phone => PhoneUtils.maskPhoneNumber(phone));
  }

  async testAdminAlert(): Promise<void> {
    const testMessage = `🧪 *TEST ALERTE ADMIN*

Ceci est un test du système d'alerte.
Si vous recevez ce message, les alertes fonctionnent correctement.

⏰ ${new Date().toLocaleString('fr-FR')}`;

    await this.sendAlertToAdmins(testMessage);
  }
}

// Export singleton instance
export const AdminAlertService = AdminAlertServiceImpl;
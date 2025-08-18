import { PrismaClient, Booking, Driver, NotificationResponse, MatchingStatus } from '@prisma/client';
import { DriverNotificationService } from '../bot/services/driver-notification.service';
import { timeoutManager } from './timeout.manager';
import { PhoneUtils } from '../bot/utils/phone.utils';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface MatchingOptions {
  maxDistance?: number;
  excludeDriverIds?: string[];
  priorityMode?: 'DISTANCE' | 'RECENT_ACTIVITY';
}

export interface MatchingResult {
  success: boolean;
  driversNotified: number;
  driverIds: string[];
  errors: string[];
  matchingMetricsId: string;
}

export interface DriverResponse {
  type: 'ACCEPT' | 'REJECT';
  timestamp: Date;
  responseTime: number;
}

export interface ResponseResult {
  success: boolean;
  action: 'ASSIGNED' | 'REJECTED' | 'ALREADY_TAKEN' | 'BOOKING_CANCELLED';
  message: string;
}

interface DriverWithDistance extends Driver {
  distance?: number;
}

export class MatchingService {
  private static instance: MatchingService;
  private driverNotificationService: DriverNotificationService | null = null;

  constructor() {
    if (MatchingService.instance) {
      return MatchingService.instance;
    }
    MatchingService.instance = this;
    this.driverNotificationService = DriverNotificationService.getInstance();
  }

  static getInstance(): MatchingService {
    if (!MatchingService.instance) {
      MatchingService.instance = new MatchingService();
    }
    return MatchingService.instance;
  }

  async startMatching(bookingId: string, options: MatchingOptions = {}): Promise<MatchingResult> {
    try {
      logger.info('Starting matching process', {
        bookingId,
        options
      });

      // 1. Vérifier que booking existe et est PENDING
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: {
            select: { phoneNumber: true }
          }
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'PENDING') {
        throw new Error(`Booking status is ${booking.status}, expected PENDING`);
      }

      // 2. Créer MatchingMetrics
      const matchingMetrics = await prisma.matchingMetrics.create({
        data: {
          bookingId,
          totalDriversNotified: 0,
          finalStatus: MatchingStatus.ACTIVE
        }
      });

      // 3. Trouver TOUS les chauffeurs disponibles
      const availableDrivers = await this.findAvailableDrivers(booking, options);

      if (availableDrivers.length === 0) {
        await prisma.matchingMetrics.update({
          where: { id: matchingMetrics.id },
          data: {
            finalStatus: MatchingStatus.TIMEOUT,
            totalDriversNotified: 0
          }
        });

        // Notifier immédiatement le client
        await this.notifyCustomerNoDrivers(booking.customer.phoneNumber);

        return {
          success: false,
          driversNotified: 0,
          driverIds: [],
          errors: ['No available drivers found'],
          matchingMetricsId: matchingMetrics.id
        };
      }

      // 4. Créer BookingNotification pour chaque chauffeur
      const notificationPromises = availableDrivers.map(driver =>
        prisma.bookingNotification.create({
          data: {
            bookingId,
            driverId: driver.id,
            notificationMethod: 'WHATSAPP'
          }
        })
      );

      await Promise.all(notificationPromises);

      // 5. Mettre à jour les métriques
      await prisma.matchingMetrics.update({
        where: { id: matchingMetrics.id },
        data: {
          totalDriversNotified: availableDrivers.length
        }
      });

      // 6. Notifier client que la recherche commence
      await this.notifyCustomerSearchStarted(
        booking.customer.phoneNumber, 
        availableDrivers.length
      );

      // 7. Broadcaster en parallèle via DriverNotificationService
      const broadcastResult = await this.driverNotificationService!.broadcastToAvailableDrivers(
        booking,
        {
          maxDrivers: undefined, // Pas de limite
          excludeDriverIds: options.excludeDriverIds
        }
      );

      // 8. Démarrer timeouts
      timeoutManager.setBookingTimeout(bookingId);
      
      // Démarrer timeout individuel pour chaque chauffeur
      availableDrivers.forEach(driver => {
        timeoutManager.setDriverTimeout(bookingId, driver.id);
      });

      logger.info('Matching process started successfully', {
        bookingId,
        driversNotified: availableDrivers.length,
        broadcastErrors: broadcastResult.errors.length,
        matchingMetricsId: matchingMetrics.id
      });

      return {
        success: true,
        driversNotified: availableDrivers.length,
        driverIds: availableDrivers.map(d => d.id),
        errors: broadcastResult.errors,
        matchingMetricsId: matchingMetrics.id
      };

    } catch (error) {
      logger.error('Failed to start matching', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        driversNotified: 0,
        driverIds: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        matchingMetricsId: ''
      };
    }
  }

  async handleDriverResponse(
    bookingId: string, 
    driverId: string, 
    response: DriverResponse
  ): Promise<ResponseResult> {
    try {
      logger.info('Handling driver response', {
        bookingId,
        driverId,
        response: response.type,
        responseTime: response.responseTime
      });

      // 1. Vérifier que notification existe
      const notification = await prisma.bookingNotification.findUnique({
        where: {
          bookingId_driverId: {
            bookingId,
            driverId
          }
        }
      });

      if (!notification) {
        return {
          success: false,
          action: 'BOOKING_CANCELLED',
          message: 'Notification not found - booking may have been cancelled'
        };
      }

      if (notification.response !== null) {
        return {
          success: false,
          action: 'ALREADY_TAKEN',
          message: 'Response already recorded'
        };
      }

      // 2. Marquer notification comme répondue
      await prisma.bookingNotification.update({
        where: {
          bookingId_driverId: {
            bookingId,
            driverId
          }
        },
        data: {
          response: response.type === 'ACCEPT' ? NotificationResponse.ACCEPTED : NotificationResponse.REJECTED,
          respondedAt: response.timestamp
        }
      });

      // 3. Annuler timeout individuel du chauffeur
      timeoutManager.clearDriverTimeout(bookingId, driverId);

      // 4. Mettre à jour métriques
      await prisma.matchingMetrics.updateMany({
        where: { bookingId },
        data: {
          totalDriversResponded: {
            increment: 1
          }
        }
      });

      // 5. Si ACCEPT → tenter assignation atomique
      if (response.type === 'ACCEPT') {
        const assignmentResult = await this.attemptBookingAssignment(bookingId, driverId);
        
        if (assignmentResult) {
          return {
            success: true,
            action: 'ASSIGNED',
            message: 'Booking successfully assigned to driver'
          };
        } else {
          return {
            success: false,
            action: 'ALREADY_TAKEN',
            message: 'Booking was already assigned to another driver'
          };
        }
      }

      // 6. Si REJECT → juste logger
      logger.info('Driver rejected booking', {
        bookingId,
        driverId,
        responseTime: response.responseTime
      });

      return {
        success: true,
        action: 'REJECTED',
        message: 'Driver response recorded'
      };

    } catch (error) {
      logger.error('Failed to handle driver response', {
        bookingId,
        driverId,
        response: response.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        action: 'BOOKING_CANCELLED',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cancelMatching(bookingId: string, reason: string): Promise<void> {
    try {
      logger.info('Cancelling matching', {
        bookingId,
        reason
      });

      // Annuler tous les timeouts
      timeoutManager.clearAllTimeouts(bookingId);

      // Marquer toutes les notifications non répondues comme timeout
      await prisma.bookingNotification.updateMany({
        where: {
          bookingId,
          response: null
        },
        data: {
          response: NotificationResponse.TIMEOUT,
          respondedAt: new Date()
        }
      });

      // Mettre à jour les métriques
      await prisma.matchingMetrics.updateMany({
        where: {
          bookingId,
          finalStatus: MatchingStatus.ACTIVE
        },
        data: {
          finalStatus: MatchingStatus.CANCELLED
        }
      });

      // Notifier les chauffeurs qui ont reçu la notification
      await this.notifyDriversBookingCancelled(bookingId);

      logger.info('Matching cancelled successfully', {
        bookingId,
        reason
      });

    } catch (error) {
      logger.error('Failed to cancel matching', {
        bookingId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async attemptBookingAssignment(bookingId: string, driverId: string): Promise<boolean> {
    try {
      logger.info('Attempting booking assignment', {
        bookingId,
        driverId
      });

      // VERROUILLAGE OPTIMISTE avec Prisma transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. SELECT booking avec version FOR UPDATE
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            customer: {
              select: {
                name: true,
                phoneNumber: true
              }
            }
          }
        });

        if (!booking) {
          throw new Error('Booking not found');
        }

        // 2. Vérifier que status est toujours PENDING
        if (booking.status !== 'PENDING') {
          logger.warn('Booking assignment failed - status changed', {
            bookingId,
            driverId,
            currentStatus: booking.status
          });
          return false;
        }

        // 3. Vérifier que booking n'a pas déjà un chauffeur
        if (booking.driverId) {
          logger.warn('Booking assignment failed - already assigned', {
            bookingId,
            driverId,
            existingDriverId: booking.driverId
          });
          return false;
        }

        // 4. Assigner le chauffeur et incrémenter version
        await tx.booking.update({
          where: { 
            id: bookingId,
            version: booking.version // Vérification optimiste
          },
          data: {
            driverId,
            status: 'ACCEPTED',
            version: {
              increment: 1
            }
          }
        });

        // 5. Récupérer info chauffeur
        const driver = await tx.driver.findUnique({
          where: { id: driverId },
          select: {
            name: true,
            phoneNumber: true,
            rating: true,
            vehicleType: true,
            vehiclePlate: true
          }
        });

        if (!driver) {
          throw new Error('Driver not found');
        }

        // 6. Marquer métriques comme matched
        await tx.matchingMetrics.updateMany({
          where: { bookingId },
          data: {
            finalStatus: MatchingStatus.MATCHED,
            acceptedAt: new Date(),
            timeToMatch: Math.floor((new Date().getTime() - booking.createdAt.getTime()) / 1000)
          }
        });

        // Retourner les données nécessaires pour les notifications
        return {
          booking,
          driver
        };
      });

      if (!result) {
        return false;
      }

      // 7. Annuler tous les timeouts (hors transaction)
      timeoutManager.clearAllTimeouts(bookingId);

      // 8. Notifier autres chauffeurs que booking est pris
      await this.notifyOtherDriversBookingTaken(bookingId, driverId);

      // 9. Notifier client du succès
      await this.notifyCustomerDriverFound(result.booking.customer.phoneNumber, {
        name: result.driver.name,
        phoneNumber: result.driver.phoneNumber,
        rating: result.driver.rating,
        vehicleType: result.driver.vehicleType,
        vehiclePlate: result.driver.vehiclePlate
      });

      logger.info('Booking assignment successful', {
        bookingId,
        driverId,
        driverName: result.driver.name,
        customerPhone: PhoneUtils.maskPhoneNumber(result.booking.customer.phoneNumber)
      });

      return true;

    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        // Race condition détectée - version a changé
        logger.warn('Booking assignment failed - race condition detected', {
          bookingId,
          driverId,
          error: 'Version mismatch'
        });
        return false;
      }

      logger.error('Failed to assign booking', {
        bookingId,
        driverId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  private async findAvailableDrivers(
    booking: Booking, 
    options: MatchingOptions
  ): Promise<DriverWithDistance[]> {
    const whereClause: any = {
      isAvailable: true,
      isVerified: true,
      isActive: true,
      isOnline: true
    };

    // Exclure chauffeurs spécifiés
    if (options.excludeDriverIds && options.excludeDriverIds.length > 0) {
      whereClause.id = {
        notIn: options.excludeDriverIds
      };
    }

    // Ordre par activité récente par défaut (pas de limite de distance)
    const orderBy = options.priorityMode === 'DISTANCE' && booking.pickupLat && booking.pickupLng
      ? undefined // On triera par distance après
      : { lastSeenAt: 'desc' as const };

    const drivers = await prisma.driver.findMany({
      where: whereClause,
      orderBy
    });

    // Calculer distances si coordonnées disponibles
    const driversWithDistance = drivers.map(driver => {
      const driverWithDist: DriverWithDistance = { ...driver };
      
      if (booking.pickupLat && booking.pickupLng && 
          driver.currentLat && driver.currentLng) {
        driverWithDist.distance = this.calculateDistance(
          booking.pickupLat,
          booking.pickupLng,
          driver.currentLat,
          driver.currentLng
        );
      }
      
      return driverWithDist;
    });

    // Filtrer par distance si spécifiée
    let filteredDrivers = driversWithDistance;
    if (options.maxDistance) {
      filteredDrivers = driversWithDistance.filter(driver => 
        !driver.distance || driver.distance <= options.maxDistance!
      );
    }

    // Trier selon priorité
    if (options.priorityMode === 'DISTANCE') {
      filteredDrivers.sort((a, b) => {
        if (a.distance && b.distance) {
          return a.distance - b.distance;
        }
        if (a.distance && !b.distance) return -1;
        if (!a.distance && b.distance) return 1;
        
        // Si pas de distance, trier par lastSeenAt
        const aLastSeen = a.lastSeenAt || new Date(0);
        const bLastSeen = b.lastSeenAt || new Date(0);
        return bLastSeen.getTime() - aLastSeen.getTime();
      });
    }

    logger.info('Available drivers found', {
      bookingId: booking.id,
      totalDrivers: drivers.length,
      filteredDrivers: filteredDrivers.length,
      priorityMode: options.priorityMode || 'RECENT_ACTIVITY',
      maxDistance: options.maxDistance
    });

    return filteredDrivers;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async notifyCustomerSearchStarted(customerPhone: string, driversCount: number): Promise<void> {
    try {
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');
      const whatsappService = WhatsAppService.getInstance();
      
      if (whatsappService) {
        const message = `🔍 *RECHERCHE DE CHAUFFEUR*

Nous recherchons un chauffeur pour votre course...
${driversCount} chauffeur${driversCount > 1 ? 's' : ''} notifié${driversCount > 1 ? 's' : ''}

⏱️ Nous vous tiendrons informé dans les 5 minutes maximum.`;

        await whatsappService.sendMessage(customerPhone, message);
      }
    } catch (error) {
      logger.error('Failed to notify customer search started', {
        customerPhone: PhoneUtils.maskPhoneNumber(customerPhone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async notifyCustomerDriverFound(customerPhone: string, driverInfo: any): Promise<void> {
    try {
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');
      const whatsappService = WhatsAppService.getInstance();
      
      if (whatsappService) {
        const message = `✅ *CHAUFFEUR TROUVÉ !*

🚗 **Chauffeur:** ${driverInfo.name}
📞 **Contact:** ${driverInfo.phoneNumber}
⭐ **Note:** ${driverInfo.rating}/5
🚗 **Véhicule:** ${driverInfo.vehicleType} - ${driverInfo.vehiclePlate}

Votre chauffeur vous contactera sous peu !`;

        await whatsappService.sendMessage(customerPhone, message);
      }
    } catch (error) {
      logger.error('Failed to notify customer driver found', {
        customerPhone: PhoneUtils.maskPhoneNumber(customerPhone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async notifyCustomerNoDrivers(customerPhone: string): Promise<void> {
    try {
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');
      const whatsappService = WhatsAppService.getInstance();
      
      if (whatsappService) {
        const message = `❌ *AUCUN CHAUFFEUR DISPONIBLE*

Malheureusement, aucun chauffeur n'est disponible actuellement pour votre course.

🔄 **Options:**
*1* - Réessayer maintenant
*2* - Programmer plus tard  
*3* - Modifier l'horaire

Nos équipes ont été alertées.`;

        await whatsappService.sendMessage(customerPhone, message);
      }
    } catch (error) {
      logger.error('Failed to notify customer no drivers', {
        customerPhone: PhoneUtils.maskPhoneNumber(customerPhone),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async notifyOtherDriversBookingTaken(bookingId: string, acceptingDriverId: string): Promise<void> {
    try {
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');
      const whatsappService = WhatsAppService.getInstance();
      
      if (!whatsappService) {
        return;
      }

      // Trouver les chauffeurs qui ont été notifiés (excluant celui qui a accepté)
      const notifiedDrivers = await prisma.bookingNotification.findMany({
        where: {
          bookingId,
          driverId: { not: acceptingDriverId },
          response: null // Seulement ceux qui n'ont pas encore répondu
        },
        include: {
          driver: {
            select: { phoneNumber: true }
          }
        }
      });

      const message = `ℹ️ La course a été acceptée par un autre chauffeur.`;

      const notifications = notifiedDrivers.map(notification =>
        whatsappService.sendMessage(notification.driver.phoneNumber, message)
      );

      await Promise.allSettled(notifications);

      logger.info('Notified other drivers of booking acceptance', {
        bookingId,
        acceptingDriverId,
        notifiedDrivers: notifiedDrivers.length
      });

    } catch (error) {
      logger.error('Failed to notify other drivers of booking acceptance', {
        bookingId,
        acceptingDriverId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async notifyDriversBookingCancelled(bookingId: string): Promise<void> {
    try {
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');
      const whatsappService = WhatsAppService.getInstance();
      
      if (!whatsappService) {
        return;
      }

      // Trouver les chauffeurs qui ont été notifiés
      const notifiedDrivers = await prisma.bookingNotification.findMany({
        where: {
          bookingId,
          response: null
        },
        include: {
          driver: {
            select: { phoneNumber: true }
          }
        }
      });

      const message = `❌ La course a été annulée par le client.`;

      const notifications = notifiedDrivers.map(notification =>
        whatsappService.sendMessage(notification.driver.phoneNumber, message)
      );

      await Promise.allSettled(notifications);

      logger.info('Notified drivers of booking cancellation', {
        bookingId,
        notifiedDrivers: notifiedDrivers.length
      });

    } catch (error) {
      logger.error('Failed to notify drivers of booking cancellation', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
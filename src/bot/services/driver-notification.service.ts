import { PrismaClient, Driver, Booking } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';
import { PhoneUtils } from '../utils/phone.utils';
import logger from '../../config/logger';

const prisma = new PrismaClient();

interface DriverWithDistance extends Driver {
  distance?: number;
}

interface BroadcastResult {
  notifiedDrivers: number;
  errors: string[];
  driverIds: string[];
}

interface DriverNotificationOptions {
  maxDrivers?: number;
  maxDistance?: number; // in kilometers
  excludeDriverIds?: string[];
}

export class DriverNotificationService {
  private static instance: DriverNotificationService;
  private whatsappService: WhatsAppService | null = null;
  private notificationTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    if (DriverNotificationService.instance) {
      return DriverNotificationService.instance;
    }
    DriverNotificationService.instance = this;
  }

  static getInstance(): DriverNotificationService {
    if (!DriverNotificationService.instance) {
      DriverNotificationService.instance = new DriverNotificationService();
    }
    return DriverNotificationService.instance;
  }

  setWhatsAppService(whatsappService: WhatsAppService): void {
    this.whatsappService = whatsappService;
  }

  async broadcastToAvailableDrivers(
    booking: Booking, 
    options: DriverNotificationOptions = {}
  ): Promise<BroadcastResult> {
    try {
      logger.info('Starting driver broadcast for booking', {
        bookingId: booking.id,
        pickupAddress: booking.pickupAddress,
        estimatedFare: booking.estimatedFare
      });

      // Find available drivers in the area
      const availableDrivers = await this.findAvailableDrivers(booking, options);
      
      if (availableDrivers.length === 0) {
        logger.warn('No available drivers found for booking', {
          bookingId: booking.id,
          pickupLat: booking.pickupLat,
          pickupLng: booking.pickupLng
        });
        
        return {
          notifiedDrivers: 0,
          errors: ['No available drivers found'],
          driverIds: []
        };
      }

      // Sort drivers by distance (if coordinates available)
      const sortedDrivers = this.sortDriversByDistance(availableDrivers);
      
      // Limit number of drivers to notify
      const maxDrivers = options.maxDrivers || 5;
      const driversToNotify = sortedDrivers.slice(0, maxDrivers);

      logger.info('Found drivers to notify', {
        bookingId: booking.id,
        totalAvailable: availableDrivers.length,
        willNotify: driversToNotify.length,
        driverIds: driversToNotify.map(d => d.id)
      });

      // Send notifications in parallel
      const results = await Promise.allSettled(
        driversToNotify.map(driver => 
          this.notifyDriver(driver, booking)
        )
      );

      // Process results
      const errors: string[] = [];
      const successfulDriverIds: string[] = [];

      results.forEach((result, index) => {
        const driver = driversToNotify[index];
        if (result.status === 'fulfilled') {
          successfulDriverIds.push(driver.id);
        } else {
          const error = `Failed to notify driver ${driver.id}: ${result.reason}`;
          errors.push(error);
          logger.error('Driver notification failed', {
            driverId: driver.id,
            phoneNumber: PhoneUtils.maskPhoneNumber(driver.phoneNumber),
            error: result.reason
          });
        }
      });

      // Set global timeout for this booking
      this.setBookingTimeout(booking.id, 30000);

      const finalResult = {
        notifiedDrivers: successfulDriverIds.length,
        errors,
        driverIds: successfulDriverIds
      };

      logger.info('Driver broadcast completed', {
        bookingId: booking.id,
        notifiedDrivers: finalResult.notifiedDrivers,
        errors: finalResult.errors.length
      });

      return finalResult;
    } catch (error) {
      logger.error('Failed to broadcast to drivers', {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        notifiedDrivers: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        driverIds: []
      };
    }
  }

  async notifyDriver(driver: Driver, booking: Booking): Promise<void> {
    if (!this.whatsappService) {
      throw new Error('WhatsApp service not initialized');
    }

    // Import DriverHandler dynamically to avoid circular dependency
    const { DriverHandler } = await import('../handlers/driver.handler');
    const driverHandler = new DriverHandler(this.whatsappService);

    // Send notification to driver
    await driverHandler.notifyBooking(driver.phoneNumber, booking);

    logger.info('Driver notified of new booking', {
      driverId: driver.id,
      phoneNumber: PhoneUtils.maskPhoneNumber(driver.phoneNumber),
      bookingId: booking.id
    });
  }

  async handleBookingTimeout(bookingId: string): Promise<void> {
    try {
      // Check if booking is still pending
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, status: true }
      });

      if (!booking || booking.status !== 'PENDING') {
        logger.info('Booking timeout handled - booking no longer pending', {
          bookingId,
          status: booking?.status || 'not found'
        });
        return;
      }

      // Expand search radius and try again with more drivers
      logger.info('Booking timeout - expanding search', { bookingId });
      
      const extendedBooking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (extendedBooking) {
        await this.broadcastToAvailableDrivers(extendedBooking, {
          maxDrivers: 10,
          maxDistance: 50 // Expand to 50km
        });
      }
    } catch (error) {
      logger.error('Failed to handle booking timeout', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async confirmBookingAcceptance(bookingId: string, driverId: string): Promise<void> {
    try {
      // Cancel timeout for this booking
      this.clearBookingTimeout(bookingId);

      // Notify other drivers that booking is taken
      await this.notifyOtherDriversBookingTaken(bookingId, driverId);

      logger.info('Booking acceptance confirmed', {
        bookingId,
        driverId
      });
    } catch (error) {
      logger.error('Failed to confirm booking acceptance', {
        bookingId,
        driverId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async findAvailableDrivers(
    booking: Booking, 
    options: DriverNotificationOptions
  ): Promise<DriverWithDistance[]> {
    const whereClause: any = {
      isAvailable: true,
      isVerified: true,
      isActive: true,
      isOnline: true
    };

    // Exclude specific drivers if specified
    if (options.excludeDriverIds && options.excludeDriverIds.length > 0) {
      whereClause.id = {
        notIn: options.excludeDriverIds
      };
    }

    // If pickup coordinates are available, find drivers in zones
    if (booking.pickupLat && booking.pickupLng) {
      // This is a simplified zone matching - in production you'd use proper geo queries
      const pickupZone = this.determinePickupZone(booking.pickupLat, booking.pickupLng);
      if (pickupZone) {
        whereClause.zones = {
          has: pickupZone
        };
      }
    }

    const drivers = await prisma.driver.findMany({
      where: whereClause,
      orderBy: { lastSeenAt: 'desc' }
    });

    // Calculate distances if coordinates are available
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

    // Filter by distance if specified
    if (options.maxDistance) {
      return driversWithDistance.filter(driver => 
        !driver.distance || driver.distance <= options.maxDistance!
      );
    }

    return driversWithDistance;
  }

  private sortDriversByDistance(
    drivers: DriverWithDistance[]
  ): DriverWithDistance[] {
    return drivers.sort((a, b) => {
      // Drivers with distance info first, sorted by distance
      if (a.distance && b.distance) {
        return a.distance - b.distance;
      }
      
      // Drivers with distance info come before those without
      if (a.distance && !b.distance) return -1;
      if (!a.distance && b.distance) return 1;
      
      // If no distance info, sort by lastSeenAt (most recent first)
      const aLastSeen = a.lastSeenAt || new Date(0);
      const bLastSeen = b.lastSeenAt || new Date(0);
      return bLastSeen.getTime() - aLastSeen.getTime();
    });
  }

  private determinePickupZone(lat: number, lng: number): string | null {
    // Simplified zone determination - in production use proper geofencing
    // This is just an example for Comoros islands
    
    // Grande Comore approximate bounds
    if (lat >= -11.9 && lat <= -11.3 && lng >= 43.2 && lng <= 43.5) {
      if (lat >= -11.7 && lng >= 43.25) return 'Moroni';
      return 'Grande Comore';
    }
    
    // Anjouan approximate bounds
    if (lat >= -12.4 && lat <= -12.0 && lng >= 44.3 && lng <= 44.6) {
      return 'Anjouan';
    }
    
    // Mohéli approximate bounds
    if (lat >= -12.4 && lat <= -12.2 && lng >= 43.7 && lng <= 44.0) {
      return 'Mohéli';
    }
    
    return null;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula for calculating distance between two points
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in kilometers
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private setBookingTimeout(bookingId: string, timeoutMs: number): void {
    // Clear existing timeout if any
    this.clearBookingTimeout(bookingId);
    
    // Set new timeout
    const timeout = setTimeout(async () => {
      await this.handleBookingTimeout(bookingId);
    }, timeoutMs);
    
    this.notificationTimeouts.set(bookingId, timeout);
    
    logger.debug('Booking timeout set', {
      bookingId,
      timeoutMs
    });
  }

  private clearBookingTimeout(bookingId: string): void {
    const timeout = this.notificationTimeouts.get(bookingId);
    if (timeout) {
      clearTimeout(timeout);
      this.notificationTimeouts.delete(bookingId);
      
      logger.debug('Booking timeout cleared', { bookingId });
    }
  }

  private async notifyOtherDriversBookingTaken(bookingId: string, acceptingDriverId: string): Promise<void> {
    if (!this.whatsappService) {
      return;
    }

    try {
      // Find drivers who might have been notified about this booking
      const driversToNotify = await prisma.driver.findMany({
        where: {
          isAvailable: true,
          isVerified: true,
          id: { not: acceptingDriverId }
        },
        select: {
          phoneNumber: true
        }
      });

      // This is a simplified approach - in production you'd track which drivers
      // were actually notified for this specific booking
      const message = `ℹ️ La course a été acceptée par un autre chauffeur.`;

      const notifications = driversToNotify.map(driver =>
        this.whatsappService!.sendMessage(driver.phoneNumber, message)
      );

      await Promise.allSettled(notifications);

      logger.info('Notified other drivers of booking acceptance', {
        bookingId,
        acceptingDriverId,
        notifiedDrivers: driversToNotify.length
      });
    } catch (error) {
      logger.error('Failed to notify other drivers of booking acceptance', {
        bookingId,
        acceptingDriverId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Clean up method
  shutdown(): void {
    // Clear all timeouts
    this.notificationTimeouts.forEach(timeout => clearTimeout(timeout));
    this.notificationTimeouts.clear();
    
    logger.info('Driver notification service shut down');
  }

  // Statistics methods
  getNotificationStats(): {
    activeTimeouts: number;
    totalNotificationsSent: number;
    totalErrors: number;
  } {
    return {
      activeTimeouts: this.notificationTimeouts.size,
      totalNotificationsSent: 0, // Would track in production
      totalErrors: 0 // Would track in production
    };
  }
}
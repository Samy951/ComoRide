import { PrismaClient, NotificationResponse, MatchingStatus } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface TimeoutManager {
  setDriverTimeout(bookingId: string, driverId: string): void;
  clearDriverTimeout(bookingId: string, driverId: string): void;
  setBookingTimeout(bookingId: string): void;
  clearBookingTimeout(bookingId: string): void;
  clearAllTimeouts(bookingId: string): void;
  cleanup(): void;
  getActiveTimeouts(): { drivers: number; bookings: number };
}

export class TimeoutManagerImpl implements TimeoutManager {
  private static instance: TimeoutManagerImpl;
  private driverTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private bookingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    if (TimeoutManagerImpl.instance) {
      return TimeoutManagerImpl.instance;
    }
    TimeoutManagerImpl.instance = this;
  }

  static getInstance(): TimeoutManagerImpl {
    if (!TimeoutManagerImpl.instance) {
      TimeoutManagerImpl.instance = new TimeoutManagerImpl();
    }
    return TimeoutManagerImpl.instance;
  }

  setDriverTimeout(bookingId: string, driverId: string): void {
    const timeoutKey = `${bookingId}:${driverId}`;
    
    // Clear existing timeout if any
    this.clearDriverTimeout(bookingId, driverId);
    
    const timeout = setTimeout(async () => {
      await this.handleDriverTimeout(bookingId, driverId);
    }, 30000); // 30 secondes
    
    this.driverTimeouts.set(timeoutKey, timeout);
    
    logger.debug('Driver timeout set', {
      bookingId,
      driverId,
      timeoutMs: 30000
    });
  }

  clearDriverTimeout(bookingId: string, driverId: string): void {
    const timeoutKey = `${bookingId}:${driverId}`;
    const timeout = this.driverTimeouts.get(timeoutKey);
    
    if (timeout) {
      clearTimeout(timeout);
      this.driverTimeouts.delete(timeoutKey);
      
      logger.debug('Driver timeout cleared', {
        bookingId,
        driverId
      });
    }
  }

  setBookingTimeout(bookingId: string): void {
    // Clear existing timeout if any
    this.clearBookingTimeout(bookingId);
    
    const timeout = setTimeout(async () => {
      await this.handleBookingTimeout(bookingId);
    }, 300000); // 5 minutes
    
    this.bookingTimeouts.set(bookingId, timeout);
    
    logger.debug('Booking timeout set', {
      bookingId,
      timeoutMs: 300000
    });
  }

  clearBookingTimeout(bookingId: string): void {
    const timeout = this.bookingTimeouts.get(bookingId);
    
    if (timeout) {
      clearTimeout(timeout);
      this.bookingTimeouts.delete(bookingId);
      
      logger.debug('Booking timeout cleared', {
        bookingId
      });
    }
  }

  clearAllTimeouts(bookingId: string): void {
    // Clear booking timeout
    this.clearBookingTimeout(bookingId);
    
    // Clear all driver timeouts for this booking
    const driverTimeoutKeys = Array.from(this.driverTimeouts.keys())
      .filter(key => key.startsWith(`${bookingId}:`));
    
    driverTimeoutKeys.forEach(key => {
      const [, driverId] = key.split(':');
      this.clearDriverTimeout(bookingId, driverId);
    });
    
    logger.info('All timeouts cleared for booking', {
      bookingId,
      clearedDriverTimeouts: driverTimeoutKeys.length
    });
  }

  cleanup(): void {
    // Clear all timeouts
    this.driverTimeouts.forEach(timeout => clearTimeout(timeout));
    this.bookingTimeouts.forEach(timeout => clearTimeout(timeout));
    
    this.driverTimeouts.clear();
    this.bookingTimeouts.clear();
    
    logger.info('Timeout manager cleaned up', {
      clearedDriverTimeouts: this.driverTimeouts.size,
      clearedBookingTimeouts: this.bookingTimeouts.size
    });
  }

  getActiveTimeouts(): { drivers: number; bookings: number } {
    return {
      drivers: this.driverTimeouts.size,
      bookings: this.bookingTimeouts.size
    };
  }

  private async handleDriverTimeout(bookingId: string, driverId: string): Promise<void> {
    try {
      logger.info('Driver timeout triggered', {
        bookingId,
        driverId
      });

      // Mark notification as timeout
      await prisma.bookingNotification.updateMany({
        where: {
          bookingId,
          driverId,
          response: null
        },
        data: {
          response: NotificationResponse.TIMEOUT,
          respondedAt: new Date()
        }
      });

      // Update metrics
      await this.updateTimeoutMetrics(bookingId);

      // Check if this was the last driver
      const remainingNotifications = await prisma.bookingNotification.count({
        where: {
          bookingId,
          response: null
        }
      });

      if (remainingNotifications === 0) {
        logger.warn('All drivers timed out for booking', {
          bookingId
        });
        
        // Trigger escalation if no global timeout is set
        const hasBookingTimeout = this.bookingTimeouts.has(bookingId);
        if (!hasBookingTimeout) {
          await this.handleBookingTimeout(bookingId);
        }
      }

      // Remove timeout from map
      const timeoutKey = `${bookingId}:${driverId}`;
      this.driverTimeouts.delete(timeoutKey);

    } catch (error) {
      logger.error('Failed to handle driver timeout', {
        bookingId,
        driverId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async handleBookingTimeout(bookingId: string): Promise<void> {
    try {
      logger.warn('Booking timeout triggered', {
        bookingId
      });

      // Check if booking is still pending
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { 
          id: true, 
          status: true,
          customer: {
            select: {
              name: true,
              phoneNumber: true
            }
          },
          pickupAddress: true,
          dropAddress: true,
          pickupTime: true
        }
      });

      if (!booking || booking.status !== 'PENDING') {
        logger.info('Booking timeout handled - booking no longer pending', {
          bookingId,
          status: booking?.status || 'not found'
        });
        return;
      }

      // Mark all remaining notifications as timeout
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

      // Update metrics as timeout
      await prisma.matchingMetrics.updateMany({
        where: {
          bookingId,
          finalStatus: MatchingStatus.ACTIVE
        },
        data: {
          finalStatus: MatchingStatus.TIMEOUT,
          updatedAt: new Date()
        }
      });

      // Clear all timeouts for this booking
      this.clearAllTimeouts(bookingId);

      // Import services dynamically to avoid circular dependencies
      const { AdminAlertService } = await import('./admin-alert.service');
      const { WhatsAppService } = await import('../bot/services/whatsapp.service');

      // Alert admin
      const adminAlertService = AdminAlertService.getInstance();
      await adminAlertService.alertBookingTimeout(bookingId, {
        name: booking.customer.name,
        phoneNumber: booking.customer.phoneNumber,
        pickupAddress: booking.pickupAddress,
        dropAddress: booking.dropAddress,
        pickupTime: booking.pickupTime
      });

      // Notify customer
      const whatsappService = WhatsAppService.getInstance();
      if (whatsappService) {
        const customerMessage = `❌ *AUCUN CHAUFFEUR DISPONIBLE*

Malheureusement, aucun chauffeur n'est disponible actuellement pour votre course.

🔄 **Options:**
*1* - Réessayer maintenant
*2* - Programmer plus tard  
*3* - Modifier l'horaire

Nos équipes ont été alertées.

ID Course: ${bookingId}`;

        await whatsappService.sendMessage(booking.customer.phoneNumber, customerMessage);
      }

      // Remove timeout from map
      this.bookingTimeouts.delete(bookingId);

    } catch (error) {
      logger.error('Failed to handle booking timeout', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateTimeoutMetrics(bookingId: string): Promise<void> {
    try {
      const timeoutCount = await prisma.bookingNotification.count({
        where: {
          bookingId,
          response: NotificationResponse.TIMEOUT
        }
      });

      await prisma.matchingMetrics.updateMany({
        where: { bookingId },
        data: {
          totalDriversResponded: {
            increment: 1
          }
        }
      });

      logger.debug('Timeout metrics updated', {
        bookingId,
        timeoutCount
      });
    } catch (error) {
      logger.error('Failed to update timeout metrics', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const timeoutManager = TimeoutManagerImpl.getInstance();
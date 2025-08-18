import { MatchingService } from '../matching.service';
import { timeoutManager } from '../timeout.manager';
import { MatchingStatus, NotificationResponse } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  booking: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  driver: {
    findMany: jest.fn(),
  },
  matchingMetrics: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  bookingNotification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

// Mock modules
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  MatchingStatus: {
    ACTIVE: 'ACTIVE',
    MATCHED: 'MATCHED',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED'
  },
  NotificationResponse: {
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    TIMEOUT: 'TIMEOUT'
  }
}));

jest.mock('../timeout.manager', () => ({
  timeoutManager: {
    setBookingTimeout: jest.fn(),
    setDriverTimeout: jest.fn(),
    clearAllTimeouts: jest.fn(),
    clearDriverTimeout: jest.fn(),
  }
}));

jest.mock('../bot/services/whatsapp.service', () => ({
  WhatsAppService: {
    getInstance: jest.fn().mockReturnValue({
      sendMessage: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

jest.mock('../admin-alert.service', () => ({
  AdminAlertService: {
    getInstance: jest.fn().mockReturnValue({
      alertBookingTimeout: jest.fn().mockResolvedValue(undefined)
    })
  }
}));

describe('MatchingService', () => {
  let matchingService: MatchingService;

  beforeEach(() => {
    jest.clearAllMocks();
    matchingService = MatchingService.getInstance();
  });

  describe('startMatching', () => {
    const mockBooking = {
      id: 'booking-1',
      status: 'PENDING',
      pickupLat: -11.7,
      pickupLng: 43.25,
      customer: {
        phoneNumber: '+269123456789'
      }
    };

    const mockDrivers = [
      {
        id: 'driver-1',
        name: 'Ahmed',
        phoneNumber: '+269111111111',
        isAvailable: true,
        isVerified: true,
        isActive: true,
        isOnline: true,
        lastSeenAt: new Date('2024-01-01T10:00:00Z')
      },
      {
        id: 'driver-2',
        name: 'Fatima',
        phoneNumber: '+269222222222',
        isAvailable: true,
        isVerified: true,
        isActive: true,
        isOnline: true,
        lastSeenAt: new Date('2024-01-01T09:00:00Z')
      }
    ];

    beforeEach(() => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.driver.findMany.mockResolvedValue(mockDrivers);
      mockPrisma.matchingMetrics.create.mockResolvedValue({
        id: 'metrics-1',
        bookingId: 'booking-1'
      });
      mockPrisma.bookingNotification.create.mockResolvedValue({});
    });

    it('should notify all available drivers', async () => {
      const result = await matchingService.startMatching('booking-1');

      expect(result.success).toBe(true);
      expect(result.driversNotified).toBe(2);
      expect(result.driverIds).toEqual(['driver-1', 'driver-2']);
      
      // Vérifier que les notifications sont créées
      expect(mockPrisma.bookingNotification.create).toHaveBeenCalledTimes(2);
      
      // Vérifier que les timeouts sont définis
      expect(timeoutManager.setBookingTimeout).toHaveBeenCalledWith('booking-1');
      expect(timeoutManager.setDriverTimeout).toHaveBeenCalledWith('booking-1', 'driver-1');
      expect(timeoutManager.setDriverTimeout).toHaveBeenCalledWith('booking-1', 'driver-2');
    });

    it('should handle no available drivers', async () => {
      mockPrisma.driver.findMany.mockResolvedValue([]);

      const result = await matchingService.startMatching('booking-1');

      expect(result.success).toBe(false);
      expect(result.driversNotified).toBe(0);
      expect(result.errors).toContain('No available drivers found');
      
      // Vérifier que les métriques sont mises à jour comme TIMEOUT
      expect(mockPrisma.matchingMetrics.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            finalStatus: MatchingStatus.TIMEOUT
          })
        })
      );
    });

    it('should handle booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      const result = await matchingService.startMatching('booking-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Booking not found');
    });

    it('should handle non-pending booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        status: 'ACCEPTED'
      });

      const result = await matchingService.startMatching('booking-1');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Booking status is ACCEPTED, expected PENDING');
    });
  });

  describe('handleDriverResponse', () => {
    const mockNotification = {
      id: 'notification-1',
      bookingId: 'booking-1',
      driverId: 'driver-1',
      response: null
    };

    beforeEach(() => {
      mockPrisma.bookingNotification.findUnique.mockResolvedValue(mockNotification);
      mockPrisma.bookingNotification.update.mockResolvedValue({});
      mockPrisma.matchingMetrics.updateMany.mockResolvedValue({});
    });

    it('should handle driver acceptance successfully', async () => {
      // Mock successful assignment
      mockPrisma.$transaction.mockImplementation(async (_callback: any) => {
        return {
          booking: {
            id: 'booking-1',
            status: 'PENDING',
            driverId: null,
            version: 1,
            customer: { name: 'Client', phoneNumber: '+269999999999' }
          },
          driver: {
            name: 'Ahmed',
            phoneNumber: '+269111111111',
            rating: 4.5,
            vehicleType: 'Sedan',
            vehiclePlate: 'COM-123'
          }
        };
      });

      const result = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-1',
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5000 }
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('ASSIGNED');
      
      // Vérifier que la notification est mise à jour
      expect(mockPrisma.bookingNotification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            response: NotificationResponse.ACCEPTED
          })
        })
      );
      
      // Vérifier que le timeout individuel est annulé
      expect(timeoutManager.clearDriverTimeout).toHaveBeenCalledWith('booking-1', 'driver-1');
    });

    it('should handle race condition during acceptance', async () => {
      // Mock race condition (version mismatch)
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        throw new Error('Record to update not found');
      });

      const result = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-1',
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5000 }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('ALREADY_TAKEN');
    });

    it('should handle driver rejection', async () => {
      const result = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-1',
        { type: 'REJECT', timestamp: new Date(), responseTime: 3000 }
      );

      expect(result.success).toBe(true);
      expect(result.action).toBe('REJECTED');
      
      // Vérifier que la notification est mise à jour
      expect(mockPrisma.bookingNotification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            response: NotificationResponse.REJECTED
          })
        })
      );
    });

    it('should handle notification not found', async () => {
      mockPrisma.bookingNotification.findUnique.mockResolvedValue(null);

      const result = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-1',
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5000 }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('BOOKING_CANCELLED');
    });

    it('should handle already responded notification', async () => {
      mockPrisma.bookingNotification.findUnique.mockResolvedValue({
        ...mockNotification,
        response: NotificationResponse.ACCEPTED
      });

      const result = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-1',
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5000 }
      );

      expect(result.success).toBe(false);
      expect(result.action).toBe('ALREADY_TAKEN');
    });
  });

  describe('cancelMatching', () => {
    beforeEach(() => {
      mockPrisma.bookingNotification.updateMany.mockResolvedValue({});
      mockPrisma.matchingMetrics.updateMany.mockResolvedValue({});
      mockPrisma.bookingNotification.findMany.mockResolvedValue([
        {
          driver: { phoneNumber: '+269111111111' }
        },
        {
          driver: { phoneNumber: '+269222222222' }
        }
      ]);
    });

    it('should cancel matching and notify drivers', async () => {
      await matchingService.cancelMatching('booking-1', 'Client cancellation');

      // Vérifier que tous les timeouts sont annulés
      expect(timeoutManager.clearAllTimeouts).toHaveBeenCalledWith('booking-1');
      
      // Vérifier que les notifications non répondues sont marquées comme timeout
      expect(mockPrisma.bookingNotification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bookingId: 'booking-1',
            response: null
          },
          data: expect.objectContaining({
            response: NotificationResponse.TIMEOUT
          })
        })
      );
      
      // Vérifier que les métriques sont mises à jour
      expect(mockPrisma.matchingMetrics.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            bookingId: 'booking-1',
            finalStatus: MatchingStatus.ACTIVE
          },
          data: expect.objectContaining({
            finalStatus: MatchingStatus.CANCELLED
          })
        })
      );
    });
  });

  describe('race condition scenarios', () => {
    it('should handle concurrent driver acceptances correctly', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: 'PENDING',
        driverId: null,
        version: 1,
        customer: { name: 'Client', phoneNumber: '+269999999999' }
      };

      const mockDriver = {
        name: 'Ahmed',
        phoneNumber: '+269111111111',
        rating: 4.5,
        vehicleType: 'Sedan',
        vehiclePlate: 'COM-123'
      };

      // Mock première acceptation réussie
      mockPrisma.$transaction
        .mockResolvedValueOnce({
          booking: mockBooking,
          driver: mockDriver
        })
        // Mock deuxième acceptation échoue (race condition)
        .mockRejectedValueOnce(new Error('Record to update not found'));

      mockPrisma.bookingNotification.findUnique.mockResolvedValue({
        id: 'notification-1',
        bookingId: 'booking-1',
        driverId: 'driver-1',
        response: null
      });

      // Première acceptation
      const result1 = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-1',
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5000 }
      );

      // Deuxième acceptation (simultanée)
      const result2 = await matchingService.handleDriverResponse(
        'booking-1',
        'driver-2',
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5100 }
      );

      expect(result1.success).toBe(true);
      expect(result1.action).toBe('ASSIGNED');
      
      expect(result2.success).toBe(false);
      expect(result2.action).toBe('ALREADY_TAKEN');
    });
  });
});
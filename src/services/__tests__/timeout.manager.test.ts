import { TimeoutManagerImpl } from '../timeout.manager';
import { PrismaClient, NotificationResponse, MatchingStatus } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  bookingNotification: {
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
  },
  matchingMetrics: {
    updateMany: jest.fn(),
  },
} as any;

// Mock modules
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  NotificationResponse: {
    TIMEOUT: 'TIMEOUT'
  },
  MatchingStatus: {
    ACTIVE: 'ACTIVE',
    TIMEOUT: 'TIMEOUT'
  }
}));

jest.mock('../admin-alert.service', () => ({
  AdminAlertService: {
    getInstance: jest.fn().mockReturnValue({
      alertBookingTimeout: jest.fn().mockResolvedValue(true)
    })
  }
}));

jest.mock('../bot/services/whatsapp.service', () => ({
  WhatsAppService: {
    getInstance: jest.fn().mockReturnValue({
      sendMessage: jest.fn().mockResolvedValue(true)
    })
  }
}));

describe('TimeoutManager', () => {
  let timeoutManager: TimeoutManagerImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    timeoutManager = new TimeoutManagerImpl();
  });

  afterEach(() => {
    jest.useRealTimers();
    timeoutManager.cleanup();
  });

  describe('setDriverTimeout', () => {
    it('should set driver timeout correctly', () => {
      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.drivers).toBe(1);
    });

    it('should replace existing driver timeout', () => {
      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      timeoutManager.setDriverTimeout('booking-1', 'driver-1'); // Replace
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.drivers).toBe(1); // Should still be 1
    });

    it('should trigger timeout after 30 seconds', async () => {
      mockPrisma.bookingNotification.updateMany.mockResolvedValue({});
      mockPrisma.bookingNotification.count.mockResolvedValue(0);

      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      
      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);
      
      // Wait for async operations
      await jest.runAllTicks();
      
      // Vérifier que la notification est marquée comme timeout
      expect(mockPrisma.bookingNotification.updateMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'booking-1',
          driverId: 'driver-1',
          response: null
        },
        data: {
          response: NotificationResponse.TIMEOUT,
          respondedAt: expect.any(Date)
        }
      });
    });
  });

  describe('setBookingTimeout', () => {
    it('should set booking timeout correctly', () => {
      timeoutManager.setBookingTimeout('booking-1');
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.bookings).toBe(1);
    });

    it('should trigger timeout after 5 minutes', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: 'PENDING',
        customer: {
          name: 'Test Client',
          phoneNumber: '+269123456789'
        },
        pickupAddress: 'Test Address',
        dropAddress: 'Test Destination',
        pickupTime: new Date()
      };

      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.bookingNotification.updateMany.mockResolvedValue({});
      mockPrisma.matchingMetrics.updateMany.mockResolvedValue({});

      timeoutManager.setBookingTimeout('booking-1');
      
      // Fast-forward 5 minutes
      jest.advanceTimersByTime(300000);
      
      // Wait for async operations
      await jest.runAllTicks();
      
      // Vérifier que les notifications sont marquées comme timeout
      expect(mockPrisma.bookingNotification.updateMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'booking-1',
          response: null
        },
        data: {
          response: NotificationResponse.TIMEOUT,
          respondedAt: expect.any(Date)
        }
      });

      // Vérifier que les métriques sont mises à jour
      expect(mockPrisma.matchingMetrics.updateMany).toHaveBeenCalledWith({
        where: {
          bookingId: 'booking-1',
          finalStatus: MatchingStatus.ACTIVE
        },
        data: {
          finalStatus: MatchingStatus.TIMEOUT,
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should not process timeout for non-pending booking', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: 'ACCEPTED' // Not PENDING
      };

      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);

      timeoutManager.setBookingTimeout('booking-1');
      
      // Fast-forward 5 minutes
      jest.advanceTimersByTime(300000);
      
      // Wait for async operations
      await jest.runAllTicks();
      
      // Vérifier qu'aucune action n'est prise
      expect(mockPrisma.bookingNotification.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.matchingMetrics.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('clearTimeout', () => {
    it('should clear driver timeout', () => {
      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      timeoutManager.clearDriverTimeout('booking-1', 'driver-1');
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.drivers).toBe(0);
    });

    it('should clear booking timeout', () => {
      timeoutManager.setBookingTimeout('booking-1');
      timeoutManager.clearBookingTimeout('booking-1');
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.bookings).toBe(0);
    });

    it('should clear all timeouts for booking', () => {
      timeoutManager.setBookingTimeout('booking-1');
      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      timeoutManager.setDriverTimeout('booking-1', 'driver-2');
      
      timeoutManager.clearAllTimeouts('booking-1');
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.bookings).toBe(0);
      expect(stats.drivers).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should clear all timeouts', () => {
      timeoutManager.setBookingTimeout('booking-1');
      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      timeoutManager.setDriverTimeout('booking-2', 'driver-2');
      
      timeoutManager.cleanup();
      
      const stats = timeoutManager.getActiveTimeouts();
      expect(stats.bookings).toBe(0);
      expect(stats.drivers).toBe(0);
    });
  });

  describe('handleDriverTimeout', () => {
    it('should trigger booking timeout when last driver times out', async () => {
      mockPrisma.bookingNotification.updateMany.mockResolvedValue({});
      mockPrisma.bookingNotification.count.mockResolvedValue(0); // No remaining notifications

      const mockBooking = {
        id: 'booking-1',
        status: 'PENDING',
        customer: {
          name: 'Test Client',
          phoneNumber: '+269123456789'
        },
        pickupAddress: 'Test Address',
        dropAddress: 'Test Destination',
        pickupTime: new Date()
      };

      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.matchingMetrics.updateMany.mockResolvedValue({});

      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      
      // Fast-forward to trigger driver timeout
      jest.advanceTimersByTime(30000);
      
      // Wait for async operations
      await jest.runAllTicks();
      
      // Should trigger booking timeout as well since it was the last driver
      expect(mockPrisma.matchingMetrics.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            finalStatus: MatchingStatus.TIMEOUT
          })
        })
      );
    });

    it('should not trigger booking timeout when other drivers remain', async () => {
      mockPrisma.bookingNotification.updateMany.mockResolvedValue({});
      mockPrisma.bookingNotification.count.mockResolvedValue(1); // 1 remaining notification

      timeoutManager.setDriverTimeout('booking-1', 'driver-1');
      
      // Fast-forward to trigger driver timeout
      jest.advanceTimersByTime(30000);
      
      // Wait for async operations
      await jest.runAllTicks();
      
      // Should NOT trigger booking timeout since other drivers remain
      expect(mockPrisma.matchingMetrics.updateMany).not.toHaveBeenCalled();
    });
  });
});
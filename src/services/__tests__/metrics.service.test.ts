import { MetricsServiceImpl } from '../metrics.service';
import { PrismaClient, MatchingStatus, NotificationResponse } from '@prisma/client';
import { jest } from '@jest/globals';

// Mock Prisma
const mockPrisma = {
  matchingMetrics: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  bookingNotification: {
    count: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
  driver: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
} as any;

// Mock modules
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  MatchingStatus: {
    ACTIVE: 'ACTIVE',
    MATCHED: 'MATCHED',
    TIMEOUT: 'TIMEOUT'
  },
  NotificationResponse: {
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    TIMEOUT: 'TIMEOUT'
  }
}));

describe('MetricsService', () => {
  let metricsService: MetricsServiceImpl;

  beforeEach(() => {
    jest.clearAllMocks();
    metricsService = MetricsServiceImpl.getInstance();
  });

  describe('getActiveMatchings', () => {
    it('should return count of active matchings', async () => {
      mockPrisma.matchingMetrics.count.mockResolvedValue(5);

      const result = await metricsService.getActiveMatchings();

      expect(result).toBe(5);
      expect(mockPrisma.matchingMetrics.count).toHaveBeenCalledWith({
        where: {
          finalStatus: MatchingStatus.ACTIVE
        }
      });
    });

    it('should return 0 on error', async () => {
      mockPrisma.matchingMetrics.count.mockRejectedValue(new Error('Database error'));

      const result = await metricsService.getActiveMatchings();

      expect(result).toBe(0);
    });
  });

  describe('getAverageMatchingTime', () => {
    const timeframe = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-01T23:59:59Z')
    };

    it('should calculate average matching time', async () => {
      mockPrisma.matchingMetrics.aggregate.mockResolvedValue({
        _avg: { timeToMatch: 120.5 }
      });

      const result = await metricsService.getAverageMatchingTime(timeframe);

      expect(result).toBe(121); // Rounded
      expect(mockPrisma.matchingMetrics.aggregate).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: timeframe.start,
            lte: timeframe.end
          },
          finalStatus: MatchingStatus.MATCHED,
          timeToMatch: {
            not: null
          }
        },
        _avg: {
          timeToMatch: true
        }
      });
    });

    it('should return 0 when no data', async () => {
      mockPrisma.matchingMetrics.aggregate.mockResolvedValue({
        _avg: { timeToMatch: null }
      });

      const result = await metricsService.getAverageMatchingTime(timeframe);

      expect(result).toBe(0);
    });
  });

  describe('getAcceptanceRate', () => {
    const timeframe = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-01T23:59:59Z')
    };

    it('should calculate acceptance rate', async () => {
      mockPrisma.bookingNotification.count
        .mockResolvedValueOnce(100) // Total notifications
        .mockResolvedValueOnce(75); // Accepted notifications

      const result = await metricsService.getAcceptanceRate(timeframe);

      expect(result).toBe(75);
    });

    it('should return 0 when no notifications', async () => {
      mockPrisma.bookingNotification.count
        .mockResolvedValueOnce(0) // Total notifications
        .mockResolvedValueOnce(0); // Accepted notifications

      const result = await metricsService.getAcceptanceRate(timeframe);

      expect(result).toBe(0);
    });
  });

  describe('getTimeoutRate', () => {
    const timeframe = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-01T23:59:59Z')
    };

    it('should calculate timeout rate', async () => {
      mockPrisma.matchingMetrics.count
        .mockResolvedValueOnce(50) // Total bookings
        .mockResolvedValueOnce(5); // Timeout bookings

      const result = await metricsService.getTimeoutRate(timeframe);

      expect(result).toBe(10);
    });

    it('should return 0 when no bookings', async () => {
      mockPrisma.matchingMetrics.count
        .mockResolvedValueOnce(0) // Total bookings
        .mockResolvedValueOnce(0); // Timeout bookings

      const result = await metricsService.getTimeoutRate(timeframe);

      expect(result).toBe(0);
    });
  });

  describe('getDriverResponseStats', () => {
    const timeframe = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-01T23:59:59Z')
    };

    const mockDriver = {
      name: 'Ahmed Ali'
    };

    const mockNotifications = [
      {
        response: NotificationResponse.ACCEPTED,
        sentAt: new Date('2024-01-01T10:00:00Z'),
        respondedAt: new Date('2024-01-01T10:01:00Z')
      },
      {
        response: NotificationResponse.REJECTED,
        sentAt: new Date('2024-01-01T11:00:00Z'),
        respondedAt: new Date('2024-01-01T11:00:30Z')
      },
      {
        response: NotificationResponse.TIMEOUT,
        sentAt: new Date('2024-01-01T12:00:00Z'),
        respondedAt: new Date('2024-01-01T12:00:30Z')
      },
      {
        response: null, // No response yet
        sentAt: new Date('2024-01-01T13:00:00Z'),
        respondedAt: null
      }
    ];

    beforeEach(() => {
      mockPrisma.driver.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.bookingNotification.findMany.mockResolvedValue(mockNotifications);
    });

    it('should calculate driver response stats correctly', async () => {
      const result = await metricsService.getDriverResponseStats('driver-1', timeframe);

      expect(result).toEqual({
        driverId: 'driver-1',
        driverName: 'Ahmed Ali',
        notificationsReceived: 4,
        responsesGiven: 3, // Excluding null response
        acceptanceRate: 33.33, // 1 out of 3 responses
        averageResponseTime: 30, // (60 + 30) / 2 = 45 seconds, but timeout excluded
        timeoutCount: 1
      });
    });

    it('should handle driver not found', async () => {
      mockPrisma.driver.findUnique.mockResolvedValue(null);

      const result = await metricsService.getDriverResponseStats('driver-1', timeframe);

      expect(result.driverName).toBe('Unknown');
      expect(result.notificationsReceived).toBe(0);
    });
  });

  describe('generateDailyReport', () => {
    const testDate = new Date('2024-01-01');

    const mockBookings = [
      {
        id: 'booking-1',
        status: 'ACCEPTED',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        metrics: {
          finalStatus: MatchingStatus.MATCHED,
          timeToMatch: 60,
          totalDriversNotified: 5
        }
      },
      {
        id: 'booking-2',
        status: 'PENDING',
        createdAt: new Date('2024-01-01T14:00:00Z'),
        metrics: {
          finalStatus: MatchingStatus.TIMEOUT,
          timeToMatch: null,
          totalDriversNotified: 3
        }
      },
      {
        id: 'booking-3',
        status: 'CANCELLED',
        createdAt: new Date('2024-01-01T16:00:00Z'),
        metrics: null
      }
    ];

    beforeEach(() => {
      mockPrisma.booking.findMany.mockResolvedValue(mockBookings);
      mockPrisma.driver.count.mockResolvedValue(12); // Active drivers
    });

    it('should generate comprehensive daily report', async () => {
      const result = await metricsService.generateDailyReport(testDate);

      expect(result).toEqual({
        date: testDate,
        totalBookings: 3,
        successfulMatches: 1,
        timeoutBookings: 1,
        cancelledBookings: 1,
        averageMatchingTime: 60,
        averageDriversNotified: 4, // (5 + 3) / 2
        successRate: 33.33,
        timeoutRate: 33.33,
        activeDrivers: 12,
        peakHour: 10, // First booking hour
        slowestMatchingTime: 60,
        fastestMatchingTime: 60
      });
    });

    it('should handle no bookings', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);

      const result = await metricsService.generateDailyReport(testDate);

      expect(result.totalBookings).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.timeoutRate).toBe(0);
    });
  });

  describe('getTopPerformingDrivers', () => {
    const timeframe = {
      start: new Date('2024-01-01T00:00:00Z'),
      end: new Date('2024-01-01T23:59:59Z')
    };

    const mockDrivers = [
      { id: 'driver-1', name: 'Ahmed' },
      { id: 'driver-2', name: 'Fatima' },
      { id: 'driver-3', name: 'Mohamed' }
    ];

    beforeEach(() => {
      mockPrisma.driver.findMany.mockResolvedValue(mockDrivers);
      
      // Mock driver stats calls
      jest.spyOn(metricsService, 'getDriverResponseStats')
        .mockResolvedValueOnce({
          driverId: 'driver-1',
          driverName: 'Ahmed',
          notificationsReceived: 20,
          responsesGiven: 18,
          acceptanceRate: 90,
          averageResponseTime: 15,
          timeoutCount: 2
        })
        .mockResolvedValueOnce({
          driverId: 'driver-2',
          driverName: 'Fatima',
          notificationsReceived: 15,
          responsesGiven: 12,
          acceptanceRate: 80,
          averageResponseTime: 20,
          timeoutCount: 3
        })
        .mockResolvedValueOnce({
          driverId: 'driver-3',
          driverName: 'Mohamed',
          notificationsReceived: 0, // Should be filtered out
          responsesGiven: 0,
          acceptanceRate: 0,
          averageResponseTime: 0,
          timeoutCount: 0
        });
    });

    it('should return top performing drivers sorted by acceptance rate', async () => {
      const result = await metricsService.getTopPerformingDrivers(timeframe, 5);

      expect(result).toHaveLength(2); // Mohamed filtered out (0 notifications)
      expect(result[0].driverName).toBe('Ahmed'); // Higher acceptance rate
      expect(result[1].driverName).toBe('Fatima');
    });

    it('should limit results correctly', async () => {
      const result = await metricsService.getTopPerformingDrivers(timeframe, 1);

      expect(result).toHaveLength(1);
      expect(result[0].driverName).toBe('Ahmed');
    });
  });

  describe('getSystemHealthMetrics', () => {
    beforeEach(() => {
      // Mock all the calls
      mockPrisma.matchingMetrics.count.mockResolvedValue(3); // Active matchings
      mockPrisma.booking.count.mockResolvedValue(10); // Recent bookings
      mockPrisma.driver.count.mockResolvedValue(8); // Active drivers
      
      // Mock aggregate calls for average matching times
      mockPrisma.matchingMetrics.aggregate
        .mockResolvedValueOnce({ _avg: { timeToMatch: 45 } }) // 1h avg
        .mockResolvedValueOnce({ _avg: { timeToMatch: 60 } }); // 24h avg
      
      // Mock timeout rate calls
      mockPrisma.matchingMetrics.count
        .mockResolvedValueOnce(20) // Total 1h
        .mockResolvedValueOnce(2)  // Timeout 1h
        .mockResolvedValueOnce(100) // Total 24h
        .mockResolvedValueOnce(5);  // Timeout 24h
    });

    it('should return comprehensive health metrics', async () => {
      const result = await metricsService.getSystemHealthMetrics();

      expect(result).toMatchObject({
        overall: 'HEALTHY',
        activeMatchings: 3,
        recentBookings: 10,
        activeDrivers: 8,
        performance: {
          averageMatchingTime1h: '45s',
          averageMatchingTime24h: '60s',
          timeoutRate1h: '10%',
          timeoutRate24h: '5%'
        },
        components: {
          database: 'HEALTHY',
          matching: 'HEALTHY',
          drivers: 'HEALTHY',
          timeouts: 'HEALTHY'
        }
      });
    });

    it('should return CRITICAL status on high timeout rate', async () => {
      // Mock high timeout rate
      mockPrisma.matchingMetrics.count
        .mockResolvedValueOnce(20) // Total 1h
        .mockResolvedValueOnce(7)  // Timeout 1h (35%)
        .mockResolvedValueOnce(100) // Total 24h
        .mockResolvedValueOnce(5);  // Timeout 24h

      const result = await metricsService.getSystemHealthMetrics();

      expect(result.overall).toBe('CRITICAL');
    });

    it('should return WARNING status on low driver count', async () => {
      mockPrisma.driver.count.mockResolvedValue(4); // Low driver count

      const result = await metricsService.getSystemHealthMetrics();

      expect(result.overall).toBe('WARNING');
    });
  });
});
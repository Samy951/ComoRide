import { MatchingService } from '../../matching.service';
import { timeoutManager } from '../../timeout.manager';
import { MetricsServiceImpl } from '../../metrics.service';
import { BookingService } from '../../booking.service';
import { PrismaClient } from '@prisma/client';
import { jest } from '@jest/globals';

// Cette suite de tests vérifie le workflow complet de matching
describe('Matching Flow Integration Tests', () => {
  let prisma: PrismaClient;
  let matchingService: MatchingService;
  let metricsService: MetricsServiceImpl;
  
  // Test data
  const testCustomer = {
    id: 'customer-1',
    phoneNumber: '+269123456789',
    name: 'Test Customer'
  };

  const testDrivers = [
    {
      id: 'driver-1',
      phoneNumber: '+269111111111',
      name: 'Ahmed Ali',
      isAvailable: true,
      isVerified: true,
      isActive: true,
      isOnline: true,
      lastSeenAt: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'driver-2',
      phoneNumber: '+269222222222',
      name: 'Fatima Hassan',
      isAvailable: true,
      isVerified: true,
      isActive: true,
      isOnline: true,
      lastSeenAt: new Date('2024-01-01T09:30:00Z')
    },
    {
      id: 'driver-3',
      phoneNumber: '+269333333333',
      name: 'Mohamed Said',
      isAvailable: true,
      isVerified: true,
      isActive: true,
      isOnline: true,
      lastSeenAt: new Date('2024-01-01T09:00:00Z')
    }
  ];

  beforeAll(async () => {
    // Note: En production, on utiliserait une base de test isolée
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
        }
      }
    });

    matchingService = MatchingService.getInstance();
    metricsService = MetricsServiceImpl.getInstance();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.bookingNotification.deleteMany();
    await prisma.matchingMetrics.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.customer.deleteMany();

    // Setup test data
    await prisma.customer.create({ data: testCustomer });
    await prisma.driver.createMany({ data: testDrivers });
  });

  afterEach(async () => {
    timeoutManager.cleanup();
  });

  describe('Successful Matching Flow', () => {
    it('should complete full matching workflow with driver acceptance', async () => {
      // 1. Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Moroni Centre',
          dropAddress: 'Aéroport International',
          pickupLat: -11.7,
          pickupLng: 43.25,
          dropLat: -11.53,
          dropLng: 43.27,
          pickupTime: new Date('2024-01-01T14:00:00Z'),
          passengers: 2,
          estimatedFare: 2500
        }
      });

      // 2. Start matching
      const matchingResult = await matchingService.startMatching(booking.id);

      expect(matchingResult.success).toBe(true);
      expect(matchingResult.driversNotified).toBe(3);
      expect(matchingResult.driverIds).toHaveLength(3);

      // 3. Vérifier que MatchingMetrics est créé
      const metrics = await prisma.matchingMetrics.findUnique({
        where: { bookingId: booking.id }
      });
      expect(metrics).toBeTruthy();
      expect(metrics!.totalDriversNotified).toBe(3);
      expect(metrics!.finalStatus).toBe('ACTIVE');

      // 4. Vérifier que BookingNotifications sont créées
      const notifications = await prisma.bookingNotification.findMany({
        where: { bookingId: booking.id }
      });
      expect(notifications).toHaveLength(3);
      expect(notifications.every(n => n.response === null)).toBe(true);

      // 5. Premier chauffeur accepte
      const acceptanceResult = await matchingService.handleDriverResponse(
        booking.id,
        testDrivers[0].id,
        {
          type: 'ACCEPT',
          timestamp: new Date(),
          responseTime: 5000
        }
      );

      expect(acceptanceResult.success).toBe(true);
      expect(acceptanceResult.action).toBe('ASSIGNED');

      // 6. Vérifier que booking est assigné
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(updatedBooking!.status).toBe('ACCEPTED');
      expect(updatedBooking!.driverId).toBe(testDrivers[0].id);
      expect(updatedBooking!.version).toBe(2); // Incrémentée par verrouillage optimiste

      // 7. Vérifier que métriques sont mises à jour
      const updatedMetrics = await prisma.matchingMetrics.findUnique({
        where: { bookingId: booking.id }
      });
      expect(updatedMetrics!.finalStatus).toBe('MATCHED');
      expect(updatedMetrics!.acceptedAt).toBeTruthy();
      expect(updatedMetrics!.timeToMatch).toBeGreaterThan(0);

      // 8. Vérifier que notification acceptante est mise à jour
      const acceptedNotification = await prisma.bookingNotification.findUnique({
        where: {
          bookingId_driverId: {
            bookingId: booking.id,
            driverId: testDrivers[0].id
          }
        }
      });
      expect(acceptedNotification!.response).toBe('ACCEPTED');
      expect(acceptedNotification!.respondedAt).toBeTruthy();

      // 9. Deuxième chauffeur tente d'accepter (race condition)
      const raceResult = await matchingService.handleDriverResponse(
        booking.id,
        testDrivers[1].id,
        {
          type: 'ACCEPT',
          timestamp: new Date(),
          responseTime: 6000
        }
      );

      expect(raceResult.success).toBe(false);
      expect(raceResult.action).toBe('ALREADY_TAKEN');
    });
  });

  describe('Timeout Scenarios', () => {
    it('should handle complete timeout when no drivers respond', async () => {
      jest.useFakeTimers();

      // 1. Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Zone isolée',
          dropAddress: 'Destination éloignée',
          pickupTime: new Date('2024-01-01T22:00:00Z'),
          passengers: 1,
          estimatedFare: 3000
        }
      });

      // 2. Start matching
      const matchingResult = await matchingService.startMatching(booking.id);
      expect(matchingResult.success).toBe(true);

      // 3. Fast-forward past all timeouts
      jest.advanceTimersByTime(300000); // 5 minutes
      await jest.runAllTicks();

      // 4. Vérifier que toutes les notifications sont marquées timeout
      const notifications = await prisma.bookingNotification.findMany({
        where: { bookingId: booking.id }
      });
      expect(notifications.every(n => n.response === 'TIMEOUT')).toBe(true);

      // 5. Vérifier que métriques sont mises à jour
      const metrics = await prisma.matchingMetrics.findUnique({
        where: { bookingId: booking.id }
      });
      expect(metrics!.finalStatus).toBe('TIMEOUT');

      jest.useRealTimers();
    });

    it('should handle partial timeout with eventual acceptance', async () => {
      jest.useFakeTimers();

      // 1. Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Moroni Port',
          dropAddress: 'Mitsamiouli',
          pickupTime: new Date('2024-01-01T16:00:00Z'),
          passengers: 3,
          estimatedFare: 4000
        }
      });

      // 2. Start matching
      await matchingService.startMatching(booking.id);

      // 3. Fast-forward 30 seconds (driver timeouts)
      jest.advanceTimersByTime(30000);
      await jest.runAllTicks();

      // 4. Vérifier que drivers ont timeout
      const timeoutNotifications = await prisma.bookingNotification.count({
        where: {
          bookingId: booking.id,
          response: 'TIMEOUT'
        }
      });
      expect(timeoutNotifications).toBe(3);

      // 5. Mais si un chauffeur essaie d'accepter après son timeout individuel
      const lateResult = await matchingService.handleDriverResponse(
        booking.id,
        testDrivers[0].id,
        {
          type: 'ACCEPT',
          timestamp: new Date(),
          responseTime: 35000 // Après timeout
        }
      );

      expect(lateResult.success).toBe(false);
      expect(lateResult.action).toBe('BOOKING_CANCELLED');

      jest.useRealTimers();
    });
  });

  describe('Concurrent Driver Responses', () => {
    it('should handle multiple simultaneous acceptances correctly', async () => {
      // 1. Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Hôtel Golden Tulip',
          dropAddress: 'Marché de Volo Volo',
          pickupTime: new Date('2024-01-01T12:00:00Z'),
          passengers: 1,
          estimatedFare: 1500
        }
      });

      // 2. Start matching
      await matchingService.startMatching(booking.id);

      // 3. Simulate simultaneous acceptances
      const acceptancePromises = testDrivers.map((driver, index) =>
        matchingService.handleDriverResponse(
          booking.id,
          driver.id,
          {
            type: 'ACCEPT',
            timestamp: new Date(),
            responseTime: 4000 + index * 100 // Slight variation
          }
        )
      );

      const results = await Promise.all(acceptancePromises);

      // 4. Exactly one should succeed
      const successfulResults = results.filter(r => r.success && r.action === 'ASSIGNED');
      const failedResults = results.filter(r => !r.success && r.action === 'ALREADY_TAKEN');

      expect(successfulResults).toHaveLength(1);
      expect(failedResults).toHaveLength(2);

      // 5. Verify booking state
      const finalBooking = await prisma.booking.findUnique({
        where: { id: booking.id }
      });
      expect(finalBooking!.status).toBe('ACCEPTED');
      expect(finalBooking!.driverId).toBeTruthy();

      // 6. Verify exactly one accepted notification
      const acceptedNotifications = await prisma.bookingNotification.count({
        where: {
          bookingId: booking.id,
          response: 'ACCEPTED'
        }
      });
      expect(acceptedNotifications).toBe(1);
    });
  });

  describe('Cancellation Scenarios', () => {
    it('should handle client cancellation during matching', async () => {
      // 1. Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Université des Comores',
          dropAddress: 'Hôpital El Maarouf',
          pickupTime: new Date('2024-01-01T08:00:00Z'),
          passengers: 1,
          estimatedFare: 2000
        }
      });

      // 2. Start matching
      await matchingService.startMatching(booking.id);

      // 3. Client cancels booking
      await matchingService.cancelMatching(booking.id, 'Client changed mind');

      // 4. Verify all notifications marked as timeout
      const notifications = await prisma.bookingNotification.findMany({
        where: { bookingId: booking.id }
      });
      expect(notifications.every(n => n.response === 'TIMEOUT')).toBe(true);

      // 5. Verify metrics updated
      const metrics = await prisma.matchingMetrics.findUnique({
        where: { bookingId: booking.id }
      });
      expect(metrics!.finalStatus).toBe('CANCELLED');

      // 6. Try driver response after cancellation
      const postCancelResult = await matchingService.handleDriverResponse(
        booking.id,
        testDrivers[0].id,
        {
          type: 'ACCEPT',
          timestamp: new Date(),
          responseTime: 3000
        }
      );

      expect(postCancelResult.success).toBe(false);
      expect(postCancelResult.action).toBe('BOOKING_CANCELLED');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect comprehensive metrics throughout matching process', async () => {
      const startTime = new Date();

      // 1. Create multiple bookings with different outcomes
      const bookings = await Promise.all([
        // Successful booking
        prisma.booking.create({
          data: {
            customerId: testCustomer.id,
            pickupAddress: 'Location A',
            dropAddress: 'Destination A',
            pickupTime: new Date('2024-01-01T10:00:00Z'),
            passengers: 1,
            estimatedFare: 1500
          }
        }),
        // Timeout booking
        prisma.booking.create({
          data: {
            customerId: testCustomer.id,
            pickupAddress: 'Location B',
            dropAddress: 'Destination B',
            pickupTime: new Date('2024-01-01T11:00:00Z'),
            passengers: 2,
            estimatedFare: 2000
          }
        })
      ]);

      // 2. Process first booking successfully
      await matchingService.startMatching(bookings[0].id);
      await matchingService.handleDriverResponse(
        bookings[0].id,
        testDrivers[0].id,
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 5000 }
      );

      // 3. Process second booking with timeout
      await matchingService.startMatching(bookings[1].id);
      
      jest.useFakeTimers();
      jest.advanceTimersByTime(300000); // 5 minutes
      await jest.runAllTicks();
      jest.useRealTimers();

      // 4. Collect metrics
      const timeframe = {
        start: startTime,
        end: new Date()
      };

      const [
        activeMatchings,
        avgMatchingTime,
        acceptanceRate,
        timeoutRate
      ] = await Promise.all([
        metricsService.getActiveMatchings(),
        metricsService.getAverageMatchingTime(timeframe),
        metricsService.getAcceptanceRate(timeframe),
        metricsService.getTimeoutRate(timeframe)
      ]);

      expect(activeMatchings).toBe(0); // All completed
      expect(avgMatchingTime).toBeGreaterThan(0);
      expect(acceptanceRate).toBeGreaterThan(0);
      expect(timeoutRate).toBe(50); // 1 out of 2 bookings timed out

      // 5. Generate daily report
      const dailyReport = await metricsService.generateDailyReport(new Date('2024-01-01'));
      
      expect(dailyReport.totalBookings).toBe(2);
      expect(dailyReport.successfulMatches).toBe(1);
      expect(dailyReport.timeoutBookings).toBe(1);
      expect(dailyReport.successRate).toBe(50);
    });
  });

  describe('Driver Response Stats', () => {
    it('should track detailed driver response statistics', async () => {
      // 1. Create multiple bookings
      const bookings = await Promise.all([
        prisma.booking.create({
          data: {
            customerId: testCustomer.id,
            pickupAddress: 'Test A',
            dropAddress: 'Test A Dest',
            pickupTime: new Date('2024-01-01T10:00:00Z'),
            passengers: 1,
            estimatedFare: 1500
          }
        }),
        prisma.booking.create({
          data: {
            customerId: testCustomer.id,
            pickupAddress: 'Test B',
            dropAddress: 'Test B Dest',
            pickupTime: new Date('2024-01-01T11:00:00Z'),
            passengers: 1,
            estimatedFare: 1500
          }
        })
      ]);

      // 2. Start matching for both
      await Promise.all(bookings.map(b => matchingService.startMatching(b.id)));

      // 3. Driver 1 accepts first, rejects second
      await matchingService.handleDriverResponse(
        bookings[0].id,
        testDrivers[0].id,
        { type: 'ACCEPT', timestamp: new Date(), responseTime: 4000 }
      );

      await matchingService.handleDriverResponse(
        bookings[1].id,
        testDrivers[0].id,
        { type: 'REJECT', timestamp: new Date(), responseTime: 2000 }
      );

      // 4. Check driver stats
      const timeframe = {
        start: new Date('2024-01-01T00:00:00Z'),
        end: new Date('2024-01-01T23:59:59Z')
      };

      const driverStats = await metricsService.getDriverResponseStats(
        testDrivers[0].id,
        timeframe
      );

      expect(driverStats.notificationsReceived).toBe(2);
      expect(driverStats.responsesGiven).toBe(2);
      expect(driverStats.acceptanceRate).toBe(50); // 1 out of 2
      expect(driverStats.averageResponseTime).toBe(3); // (4000 + 2000) / 2 / 1000
      expect(driverStats.timeoutCount).toBe(0);
    });
  });
});
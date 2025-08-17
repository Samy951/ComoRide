import { PrismaClient } from '@prisma/client';
import { calculateEstimatedFare, calculateDistance } from '../../../src/utils/validation';

const prisma = new PrismaClient();

describe('Booking Flow Integration', () => {
  let testCustomer: any;
  let testDrivers: any[];

  beforeAll(async () => {
    // Clean test data
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.customer.deleteMany();

    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        phoneNumber: '+2693321234',
        name: 'Ali Mohamed Said',
      },
    });

    // Create test drivers
    testDrivers = await Promise.all([
      prisma.driver.create({
        data: {
          phoneNumber: '+2693111111',
          name: 'Ahmed Driver Moroni',
          licenseNumber: 'KM2024001',
          vehicleType: 'Sedan',
          vehiclePlate: 'AB-111-KM',
          zones: ['Moroni', 'Iconi'],
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLat: -11.7042,
          currentLng: 43.2402,
          lastSeenAt: new Date(),
        },
      }),
      prisma.driver.create({
        data: {
          phoneNumber: '+2693222222',
          name: 'Moussa Driver Mutsamudu',
          licenseNumber: 'KM2024002',
          vehicleType: 'SUV',
          vehiclePlate: 'CD-222-KM',
          zones: ['Mutsamudu', 'Mbeni'],
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLat: -12.1667,
          currentLng: 44.4167,
          lastSeenAt: new Date(),
        },
      }),
      prisma.driver.create({
        data: {
          phoneNumber: '+2693333333',
          name: 'Hassan Driver Offline',
          licenseNumber: 'KM2024003',
          vehicleType: 'Minibus',
          vehiclePlate: 'EF-333-KM',
          zones: ['Moroni'],
          isAvailable: true,
          isOnline: false, // Offline
          isVerified: true,
          lastSeenAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean bookings and trips between tests
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
  });

  describe('Complete Booking Workflow: PENDING → ACCEPTED → COMPLETED', () => {
    it('should handle complete successful booking flow', async () => {
      // Step 1: Customer creates a booking
      const pickupLat = -11.7042;
      const pickupLng = 43.2402;
      const dropLat = -11.5336;
      const dropLng = 43.2719;
      const distance = calculateDistance(pickupLat, pickupLng, dropLat, dropLng);
      const estimatedFare = calculateEstimatedFare(distance);

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Place de France, Moroni',
          dropAddress: 'Aéroport Prince Said Ibrahim',
          pickupLat,
          pickupLng,
          dropLat,
          dropLng,
          pickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          passengers: 2,
          notes: 'Vol Air Austral 15h30, j\'ai deux valises',
          estimatedFare,
        },
      });

      expect(booking.status).toBe('PENDING');
      expect(booking.driverId).toBeNull();
      expect(booking.estimatedFare).toBeCloseTo(estimatedFare, 0);

      // Step 2: Find available drivers in the zone
      const availableDrivers = await prisma.driver.findMany({
        where: {
          zones: {
            has: 'Moroni', // Driver covers pickup zone
          },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
        orderBy: {
          rating: 'desc',
        },
      });

      expect(availableDrivers).toHaveLength(1);
      expect(availableDrivers[0].id).toBe(testDrivers[0].id);

      // Step 3: Driver accepts the booking
      const acceptedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'ACCEPTED',
          driverId: availableDrivers[0].id,
        },
      });

      expect(acceptedBooking.status).toBe('ACCEPTED');
      expect(acceptedBooking.driverId).toBe(availableDrivers[0].id);

      // Step 4: Driver becomes unavailable (busy with this booking)
      await prisma.driver.update({
        where: { id: availableDrivers[0].id },
        data: { isAvailable: false },
      });

      // Step 5: Trip starts
      const tripStartTime = new Date();
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED' },
      });

      // Step 6: Create trip record
      const actualFare = 3200; // Could be different from estimate
      const actualDistance = 18.5;

      const trip = await prisma.trip.create({
        data: {
          bookingId: booking.id,
          customerId: testCustomer.id,
          driverId: availableDrivers[0].id,
          startTime: tripStartTime,
          endTime: new Date(tripStartTime.getTime() + 30 * 60 * 1000), // 30 minutes later
          fare: actualFare,
          distance: actualDistance,
          paymentMethod: 'CASH',
          paymentStatus: 'COMPLETED',
          customerRating: 5,
          driverRating: 4,
        },
      });

      // Step 7: Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: actualFare,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          metadata: {
            estimatedFare,
            actualDistance,
            duration: '30 minutes',
            route: 'Moroni → Aéroport',
          },
        },
      });

      // Step 8: Driver becomes available again
      await prisma.driver.update({
        where: { id: availableDrivers[0].id },
        data: { 
          isAvailable: true,
          currentLat: dropLat, // Driver is now at drop location
          currentLng: dropLng,
          lastSeenAt: new Date(),
        },
      });

      // Verify complete workflow
      const finalBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          customer: true,
          driver: true,
          trip: {
            include: {
              transaction: true,
            },
          },
        },
      });

      expect(finalBooking?.status).toBe('COMPLETED');
      expect(finalBooking?.trip).toBeDefined();
      expect(finalBooking?.trip?.transaction).toBeDefined();
      expect(finalBooking?.trip?.customerRating).toBe(5);
      expect(finalBooking?.trip?.driverRating).toBe(4);
      expect(finalBooking?.trip?.transaction?.status).toBe('COMPLETED');

      // Verify driver is available again
      const updatedDriver = await prisma.driver.findUnique({
        where: { id: availableDrivers[0].id },
      });
      expect(updatedDriver?.isAvailable).toBe(true);
      expect(updatedDriver?.currentLat).toBe(dropLat);
      expect(updatedDriver?.currentLng).toBe(dropLng);
    });
  });

  describe('Booking Cancellation Workflow', () => {
    it('should handle customer cancellation before driver assignment', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Hotel Retaj, Moroni',
          dropAddress: 'Port de Moroni',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          passengers: 1,
        },
      });

      expect(booking.status).toBe('PENDING');

      // Customer cancels before driver assignment
      const cancelledBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancellationReason: 'Changement de plan du client',
        },
      });

      expect(cancelledBooking.status).toBe('CANCELLED');
      expect(cancelledBooking.cancellationReason).toBe('Changement de plan du client');
      expect(cancelledBooking.driverId).toBeNull();
    });

    it('should handle driver cancellation after acceptance', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Itsandra Plage',
          dropAddress: 'Marché Volo Volo',
          pickupTime: new Date(Date.now() + 90 * 60 * 1000),
          passengers: 3,
        },
      });

      // Driver accepts
      const acceptedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'ACCEPTED',
          driverId: testDrivers[0].id,
        },
      });

      expect(acceptedBooking.status).toBe('ACCEPTED');

      // Driver cancels (becomes unavailable due to emergency)
      const cancelledBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          driverId: null, // Remove driver assignment
          cancellationReason: 'Chauffeur indisponible - urgence familiale',
        },
      });

      expect(cancelledBooking.status).toBe('CANCELLED');
      expect(cancelledBooking.driverId).toBeNull();
      expect(cancelledBooking.cancellationReason).toContain('urgence familiale');
    });
  });

  describe('Driver Rejection and Reassignment Workflow', () => {
    it('should handle driver rejection and find alternative driver', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Gare routière Moroni',
          dropAddress: 'Université des Comores',
          pickupTime: new Date(Date.now() + 45 * 60 * 1000),
          passengers: 1,
        },
      });

      // First driver accepts
      const acceptedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'ACCEPTED',
          driverId: testDrivers[0].id,
        },
      });

      expect(acceptedBooking.status).toBe('ACCEPTED');

      // First driver rejects (changes mind)
      const rejectedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'REJECTED',
          driverId: null,
          cancellationReason: 'Chauffeur a refusé - trop occupé',
        },
      });

      expect(rejectedBooking.status).toBe('REJECTED');
      expect(rejectedBooking.driverId).toBeNull();

      // Reset booking to pending for reassignment
      const pendingBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'PENDING',
          cancellationReason: null, // Clear rejection reason
        },
      });

      expect(pendingBooking.status).toBe('PENDING');

      // Find another available driver (in this case, no other online driver in Moroni zone)
      const availableDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          id: { not: testDrivers[0].id }, // Exclude first driver
        },
      });

      expect(availableDrivers).toHaveLength(0); // No other available drivers in Moroni

      // Booking remains pending (would trigger notifications in real system)
      const finalBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });
      expect(finalBooking?.status).toBe('PENDING');
    });
  });

  describe('Payment Workflow Integration', () => {
    it('should handle Orange Money payment workflow', async () => {
      // Create completed booking and trip
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDrivers[1].id, // Mutsamudu driver
          pickupAddress: 'Aéroport Ouani',
          dropAddress: 'Centre-ville Mutsamudu',
          pickupTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          status: 'COMPLETED',
          passengers: 1,
          estimatedFare: 2500,
        },
      });

      const trip = await prisma.trip.create({
        data: {
          bookingId: booking.id,
          customerId: testCustomer.id,
          driverId: testDrivers[1].id,
          startTime: new Date(Date.now() - 90 * 60 * 1000),
          endTime: new Date(Date.now() - 60 * 60 * 1000),
          fare: 2800,
          distance: 12.5,
          paymentMethod: 'ORANGE_MONEY',
          paymentStatus: 'PENDING',
          customerRating: 4,
          driverRating: 5,
        },
      });

      // Create pending Orange Money transaction
      const transaction = await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: 2800,
          paymentMethod: 'ORANGE_MONEY',
          status: 'PENDING',
          reference: 'OM2024001234',
          metadata: {
            orangeMoneyPhone: testCustomer.phoneNumber,
            customerName: testCustomer.name,
            driverPhone: testDrivers[1].phoneNumber,
          },
        },
      });

      expect(transaction.status).toBe('PENDING');
      expect(transaction.reference).toBe('OM2024001234');

      // Simulate Orange Money payment completion
      const completedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...transaction.metadata as any,
            completedAt: new Date().toISOString(),
            orangeMoneyTransactionId: 'OM_TX_567890',
          },
        },
      });

      // Update trip payment status
      await prisma.trip.update({
        where: { id: trip.id },
        data: { paymentStatus: 'COMPLETED' },
      });

      // Verify payment completion
      const finalTrip = await prisma.trip.findUnique({
        where: { id: trip.id },
        include: { transaction: true },
      });

      expect(finalTrip?.paymentStatus).toBe('COMPLETED');
      expect(finalTrip?.transaction?.status).toBe('COMPLETED');
      expect((finalTrip?.transaction?.metadata as any).orangeMoneyTransactionId).toBe('OM_TX_567890');
    });

    it('should handle failed payment and retry', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDrivers[0].id,
          pickupAddress: 'Médina Moroni',
          dropAddress: 'Plateau Moroni',
          pickupTime: new Date(Date.now() - 60 * 60 * 1000),
          status: 'COMPLETED',
          passengers: 2,
        },
      });

      const trip = await prisma.trip.create({
        data: {
          bookingId: booking.id,
          customerId: testCustomer.id,
          driverId: testDrivers[0].id,
          startTime: new Date(Date.now() - 60 * 60 * 1000),
          endTime: new Date(Date.now() - 45 * 60 * 1000),
          fare: 800,
          distance: 2.5,
          paymentMethod: 'ORANGE_MONEY',
          paymentStatus: 'PENDING',
        },
      });

      // First transaction fails
      const failedTransaction = await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: 800,
          paymentMethod: 'ORANGE_MONEY',
          status: 'FAILED',
          reference: 'OM2024001235',
          metadata: {
            error: 'Insufficient balance',
            attemptNumber: 1,
          },
        },
      });

      expect(failedTransaction.status).toBe('FAILED');

      // Update to cash payment as fallback
      await prisma.trip.update({
        where: { id: trip.id },
        data: { 
          paymentMethod: 'CASH',
          paymentStatus: 'COMPLETED',
        },
      });

      // Create new cash transaction
      const cashTransaction = await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: 800,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
          metadata: {
            fallbackFrom: 'ORANGE_MONEY',
            originalReference: 'OM2024001235',
          },
        },
      });

      // Verify fallback to cash
      const finalTrip = await prisma.trip.findUnique({
        where: { id: trip.id },
        include: { 
          transaction: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      expect(finalTrip?.paymentMethod).toBe('CASH');
      expect(finalTrip?.paymentStatus).toBe('COMPLETED');
    });
  });
});
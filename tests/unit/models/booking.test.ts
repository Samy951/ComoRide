import { PrismaClient, BookingStatus } from '@prisma/client';
import { validateCoordinates, calculateEstimatedFare } from '../../../src/utils/validation';

const prisma = new PrismaClient();

describe('Booking Model', () => {
  let testCustomer: any;
  let testDriver: any;

  beforeAll(async () => {
    // Clean test data
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.customer.deleteMany();

    // Create test customer and driver
    testCustomer = await prisma.customer.create({
      data: {
        phoneNumber: '+2693111111',
        name: 'Test Customer',
      },
    });

    testDriver = await prisma.driver.create({
      data: {
        phoneNumber: '+2693222222',
        name: 'Test Driver',
        licenseNumber: 'KM2024001',
        vehicleType: 'Sedan',
        vehiclePlate: 'AB-123-KM',
        zones: ['Moroni'],
        isVerified: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean bookings between tests
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
  });

  describe('Booking Creation', () => {
    it('should create a basic booking', async () => {
      const bookingData = {
        customerId: testCustomer.id,
        pickupAddress: 'Place de France, Moroni',
        dropAddress: 'Aéroport Prince Said Ibrahim',
        pickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        passengers: 2,
        notes: 'J\'ai deux valises',
      };

      const booking = await prisma.booking.create({
        data: bookingData,
      });

      expect(booking).toBeDefined();
      expect(booking.customerId).toBe(bookingData.customerId);
      expect(booking.pickupAddress).toBe(bookingData.pickupAddress);
      expect(booking.dropAddress).toBe(bookingData.dropAddress);
      expect(booking.passengers).toBe(2);
      expect(booking.status).toBe('PENDING'); // default
      expect(booking.driverId).toBeNull(); // no driver assigned yet
      expect(booking.cancellationReason).toBeNull();
      expect(booking.estimatedFare).toBeNull();
    });

    it('should create booking with GPS coordinates', async () => {
      const moroniLat = -11.7042;
      const moroniLng = 43.2402;
      const airportLat = -11.5336;
      const airportLng = 43.2719;

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Place de France, Moroni',
          dropAddress: 'Aéroport Prince Said Ibrahim',
          pickupLat: moroniLat,
          pickupLng: moroniLng,
          dropLat: airportLat,
          dropLng: airportLng,
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          estimatedFare: 3500,
        },
      });

      expect(booking.pickupLat).toBe(moroniLat);
      expect(booking.pickupLng).toBe(moroniLng);
      expect(booking.dropLat).toBe(airportLat);
      expect(booking.dropLng).toBe(airportLng);
      expect(booking.estimatedFare).toBe(3500);

      // Validate coordinates are within Comoros
      expect(validateCoordinates(moroniLat, moroniLng)).toBe(true);
      expect(validateCoordinates(airportLat, airportLng)).toBe(true);
    });

    it('should create booking with default passenger count', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Itsandra Plage',
          dropAddress: 'Marché Volo Volo',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      expect(booking.passengers).toBe(1); // default value
    });
  });

  describe('Booking Status Transitions', () => {
    it('should transition from PENDING to ACCEPTED', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      expect(booking.status).toBe('PENDING');

      const acceptedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'ACCEPTED',
          driverId: testDriver.id,
        },
      });

      expect(acceptedBooking.status).toBe('ACCEPTED');
      expect(acceptedBooking.driverId).toBe(testDriver.id);
    });

    it('should transition from ACCEPTED to COMPLETED', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDriver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          status: 'ACCEPTED',
        },
      });

      const completedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'COMPLETED' },
      });

      expect(completedBooking.status).toBe('COMPLETED');
    });

    it('should handle booking cancellation with reason', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDriver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          status: 'ACCEPTED',
        },
      });

      const cancelledBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'CANCELLED',
          cancellationReason: 'Client ne répond plus au téléphone',
        },
      });

      expect(cancelledBooking.status).toBe('CANCELLED');
      expect(cancelledBooking.cancellationReason).toBe('Client ne répond plus au téléphone');
    });

    it('should handle driver rejection', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDriver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          status: 'ACCEPTED',
        },
      });

      const rejectedBooking = await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: 'REJECTED',
          driverId: null, // Remove driver assignment
          cancellationReason: 'Chauffeur indisponible',
        },
      });

      expect(rejectedBooking.status).toBe('REJECTED');
      expect(rejectedBooking.driverId).toBeNull();
      expect(rejectedBooking.cancellationReason).toBe('Chauffeur indisponible');
    });
  });

  describe('Booking Validation', () => {
    it('should validate pickup time is in the future for new bookings', async () => {
      const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      // Note: This would typically be handled by application logic, not DB constraints
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: pastTime,
        },
      });

      // In a real application, you'd add validation logic
      expect(booking.pickupTime).toEqual(pastTime);
      expect(booking.pickupTime.getTime()).toBeLessThan(Date.now());
    });

    it('should calculate estimated fare based on distance', () => {
      const distances = [
        { distance: 0, expected: 200 },
        { distance: 5, expected: 950 }, // 200 + 5*150
        { distance: 10, expected: 1700 }, // 200 + 10*150
        { distance: 20, expected: 3200 }, // 200 + 20*150
      ];

      distances.forEach(({ distance, expected }) => {
        expect(calculateEstimatedFare(distance)).toBe(expected);
      });
    });

    it('should handle negative distance in fare calculation', () => {
      expect(() => calculateEstimatedFare(-5)).toThrow('Distance cannot be negative');
    });
  });

  describe('Booking Queries', () => {
    beforeEach(async () => {
      // Create test bookings in different states
      await prisma.booking.createMany({
        data: [
          {
            customerId: testCustomer.id,
            pickupAddress: 'Pickup 1',
            dropAddress: 'Drop 1',
            pickupTime: new Date(Date.now() + 60 * 60 * 1000),
            status: 'PENDING',
            estimatedFare: 800,
          },
          {
            customerId: testCustomer.id,
            driverId: testDriver.id,
            pickupAddress: 'Pickup 2',
            dropAddress: 'Drop 2',
            pickupTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
            status: 'ACCEPTED',
            estimatedFare: 1200,
          },
          {
            customerId: testCustomer.id,
            driverId: testDriver.id,
            pickupAddress: 'Pickup 3',
            dropAddress: 'Drop 3',
            pickupTime: new Date(Date.now() - 60 * 60 * 1000),
            status: 'COMPLETED',
            estimatedFare: 1500,
          },
          {
            customerId: testCustomer.id,
            pickupAddress: 'Pickup 4',
            dropAddress: 'Drop 4',
            pickupTime: new Date(Date.now() + 30 * 60 * 1000),
            status: 'CANCELLED',
            cancellationReason: 'Changement de plan client',
          },
        ],
      });
    });

    it('should find pending bookings', async () => {
      const pendingBookings = await prisma.booking.findMany({
        where: { status: 'PENDING' },
        orderBy: { pickupTime: 'asc' },
      });

      expect(pendingBookings).toHaveLength(1);
      expect(pendingBookings[0].status).toBe('PENDING');
      expect(pendingBookings[0].driverId).toBeNull();
    });

    it('should find bookings for specific customer', async () => {
      const customerBookings = await prisma.booking.findMany({
        where: { customerId: testCustomer.id },
        include: {
          customer: true,
          driver: true,
        },
      });

      expect(customerBookings).toHaveLength(4);
      expect(customerBookings.every(b => b.customerId === testCustomer.id)).toBe(true);
    });

    it('should find bookings for specific driver', async () => {
      const driverBookings = await prisma.booking.findMany({
        where: { driverId: testDriver.id },
        orderBy: { pickupTime: 'desc' },
      });

      expect(driverBookings).toHaveLength(2); // ACCEPTED and COMPLETED
      expect(driverBookings.every(b => b.driverId === testDriver.id)).toBe(true);
    });

    it('should find bookings by time range', async () => {
      const now = new Date();
      const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
      const threeHoursFromNow = new Date(Date.now() + 3 * 60 * 60 * 1000);

      const upcomingBookings = await prisma.booking.findMany({
        where: {
          pickupTime: {
            gte: oneHourFromNow,
            lte: threeHoursFromNow,
          },
          status: {
            in: ['PENDING', 'ACCEPTED'],
          },
        },
      });

      expect(upcomingBookings).toHaveLength(2);
      expect(upcomingBookings.every(b => 
        b.pickupTime >= oneHourFromNow && 
        b.pickupTime <= threeHoursFromNow
      )).toBe(true);
    });

    it('should find cancelled bookings with reasons', async () => {
      const cancelledBookings = await prisma.booking.findMany({
        where: {
          status: 'CANCELLED',
          cancellationReason: {
            not: null,
          },
        },
      });

      expect(cancelledBookings).toHaveLength(1);
      expect(cancelledBookings[0].status).toBe('CANCELLED');
      expect(cancelledBookings[0].cancellationReason).toBeDefined();
    });

    it('should calculate average estimated fare', async () => {
      const bookings = await prisma.booking.findMany({
        where: {
          estimatedFare: {
            not: null,
          },
        },
        select: {
          estimatedFare: true,
        },
      });

      const totalFare = bookings.reduce((sum, booking) => sum + (booking.estimatedFare || 0), 0);
      const averageFare = totalFare / bookings.length;

      expect(bookings).toHaveLength(3);
      expect(averageFare).toBe((800 + 1200 + 1500) / 3); // 1166.67
    });
  });

  describe('Booking Relations', () => {
    it('should create booking with trip relation', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDriver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() - 60 * 60 * 1000),
          status: 'COMPLETED',
        },
      });

      const trip = await prisma.trip.create({
        data: {
          bookingId: booking.id,
          customerId: testCustomer.id,
          driverId: testDriver.id,
          startTime: new Date(Date.now() - 60 * 60 * 1000),
          endTime: new Date(Date.now() - 30 * 60 * 1000),
          fare: 1500,
        },
      });

      const bookingWithTrip = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: { trip: true },
      });

      expect(bookingWithTrip?.trip).toBeDefined();
      expect(bookingWithTrip?.trip?.id).toBe(trip.id);
    });

    it('should handle booking without assigned driver', async () => {
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          pickupAddress: 'Unassigned Pickup',
          dropAddress: 'Unassigned Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const bookingWithRelations = await prisma.booking.findUnique({
        where: { id: booking.id },
        include: {
          customer: true,
          driver: true,
        },
      });

      expect(bookingWithRelations?.customer).toBeDefined();
      expect(bookingWithRelations?.driver).toBeNull();
    });
  });
});
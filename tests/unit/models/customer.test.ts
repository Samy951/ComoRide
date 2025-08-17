import { PrismaClient } from '@prisma/client';
import { validateComorianPhone } from '../../../src/utils/validation';

const prisma = new PrismaClient();

describe('Customer Model', () => {
  beforeAll(async () => {
    // Clean test data
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean between tests
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.customer.deleteMany();
  });

  describe('Customer Creation', () => {
    it('should create a customer with valid Comorian phone number', async () => {
      const customerData = {
        phoneNumber: '+2693321234',
        name: 'Ali Mohamed Said',
        rating: 4.8,
      };

      const customer = await prisma.customer.create({
        data: customerData,
      });

      expect(customer).toBeDefined();
      expect(customer.phoneNumber).toBe(customerData.phoneNumber);
      expect(customer.name).toBe(customerData.name);
      expect(customer.rating).toBe(customerData.rating);
      expect(customer.id).toBeDefined();
      expect(customer.createdAt).toBeDefined();
      expect(customer.updatedAt).toBeDefined();
    });

    it('should create a customer with default rating of 5.0', async () => {
      const customer = await prisma.customer.create({
        data: {
          phoneNumber: '+2693345678',
          name: 'Fatima Said',
        },
      });

      expect(customer.rating).toBe(5.0);
    });

    it('should fail to create customer with duplicate phone number', async () => {
      const phoneNumber = '+2693367890';
      
      await prisma.customer.create({
        data: {
          phoneNumber,
          name: 'Ibrahim Abdou',
        },
      });

      await expect(
        prisma.customer.create({
          data: {
            phoneNumber,
            name: 'Another Customer',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate correct Comorian phone numbers', () => {
      const validNumbers = [
        '+2693321234',
        '+2693987654',
        '+2691234567',
        '+2699876543'
      ];

      validNumbers.forEach(number => {
        expect(validateComorianPhone(number)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '+33123456789', // French number
        '+2693321234567', // Too long
        '+269332123', // Too short
        '2693321234', // Missing +
        '+269332123a', // Contains letter
        '+269 332 1234', // Contains spaces
        '',
        null,
        undefined
      ];

      invalidNumbers.forEach(number => {
        expect(validateComorianPhone(number as string)).toBe(false);
      });
    });
  });

  describe('Customer Relations', () => {
    it('should create customer with bookings relation', async () => {
      const customer = await prisma.customer.create({
        data: {
          phoneNumber: '+2693412345',
          name: 'Zainaba Mohamed',
        },
      });

      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693987654',
          name: 'Ahmed Driver',
          licenseNumber: 'KM2024001',
          vehicleType: 'Sedan',
          vehiclePlate: 'AB-123-KM',
          zones: ['Moroni'],
          isVerified: true,
        },
      });

      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          driverId: driver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const customerWithBookings = await prisma.customer.findUnique({
        where: { id: customer.id },
        include: { bookings: true },
      });

      expect(customerWithBookings?.bookings).toHaveLength(1);
      expect(customerWithBookings?.bookings[0].id).toBe(booking.id);
    });

    it('should create customer with trips relation', async () => {
      const customer = await prisma.customer.create({
        data: {
          phoneNumber: '+2693456789',
          name: 'Samir Hassan',
        },
      });

      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693876543',
          name: 'Moussa Driver',
          licenseNumber: 'KM2024002',
          vehicleType: 'SUV',
          vehiclePlate: 'CD-456-KM',
          zones: ['Moroni'],
          isVerified: true,
        },
      });

      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          driverId: driver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() - 60 * 60 * 1000),
          status: 'COMPLETED',
        },
      });

      const trip = await prisma.trip.create({
        data: {
          bookingId: booking.id,
          customerId: customer.id,
          driverId: driver.id,
          startTime: new Date(Date.now() - 60 * 60 * 1000),
          endTime: new Date(Date.now() - 30 * 60 * 1000),
          fare: 1500,
        },
      });

      const customerWithTrips = await prisma.customer.findUnique({
        where: { id: customer.id },
        include: { trips: true },
      });

      expect(customerWithTrips?.trips).toHaveLength(1);
      expect(customerWithTrips?.trips[0].id).toBe(trip.id);
    });
  });

  describe('Customer Queries', () => {
    beforeEach(async () => {
      // Create test customers
      await prisma.customer.createMany({
        data: [
          {
            phoneNumber: '+2693111111',
            name: 'Customer A',
            rating: 4.5,
          },
          {
            phoneNumber: '+2693222222',
            name: 'Customer B',
            rating: 5.0,
          },
          {
            phoneNumber: '+2693333333',
            name: 'Customer C',
            rating: 3.8,
          },
        ],
      });
    });

    it('should find customer by phone number', async () => {
      const customer = await prisma.customer.findUnique({
        where: { phoneNumber: '+2693111111' },
      });

      expect(customer).toBeDefined();
      expect(customer?.name).toBe('Customer A');
      expect(customer?.rating).toBe(4.5);
    });

    it('should find customers with rating above threshold', async () => {
      const customers = await prisma.customer.findMany({
        where: {
          rating: {
            gte: 4.0,
          },
        },
        orderBy: {
          rating: 'desc',
        },
      });

      expect(customers).toHaveLength(2);
      expect(customers[0].rating).toBe(5.0);
      expect(customers[1].rating).toBe(4.5);
    });

    it('should update customer rating', async () => {
      const customer = await prisma.customer.findUnique({
        where: { phoneNumber: '+2693333333' },
      });

      expect(customer?.rating).toBe(3.8);

      const updatedCustomer = await prisma.customer.update({
        where: { id: customer!.id },
        data: { rating: 4.2 },
      });

      expect(updatedCustomer.rating).toBe(4.2);
      expect(updatedCustomer.updatedAt.getTime()).toBeGreaterThan(customer!.updatedAt.getTime());
    });
  });
});
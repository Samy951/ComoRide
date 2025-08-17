import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Transaction Integrity Integration', () => {
  let testCustomer: any;
  let testDriver: any;

  beforeAll(async () => {
    // Clean test data
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.customer.deleteMany();

    // Create test entities
    testCustomer = await prisma.customer.create({
      data: {
        phoneNumber: '+2693321234',
        name: 'Test Customer',
      },
    });

    testDriver = await prisma.driver.create({
      data: {
        phoneNumber: '+2693987654',
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
    // Clean test data between tests
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce booking-customer relationship', async () => {
      const invalidCustomerId = 'invalid-customer-id';

      await expect(
        prisma.booking.create({
          data: {
            customerId: invalidCustomerId,
            pickupAddress: 'Test Pickup',
            dropAddress: 'Test Drop',
            pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce booking-driver relationship', async () => {
      const invalidDriverId = 'invalid-driver-id';

      await expect(
        prisma.booking.create({
          data: {
            customerId: testCustomer.id,
            driverId: invalidDriverId,
            pickupAddress: 'Test Pickup',
            dropAddress: 'Test Drop',
            pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce trip-booking relationship', async () => {
      const invalidBookingId = 'invalid-booking-id';

      await expect(
        prisma.trip.create({
          data: {
            bookingId: invalidBookingId,
            customerId: testCustomer.id,
            driverId: testDriver.id,
            startTime: new Date(),
            fare: 1000,
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce transaction-trip relationship', async () => {
      const invalidTripId = 'invalid-trip-id';

      await expect(
        prisma.transaction.create({
          data: {
            tripId: invalidTripId,
            amount: 1000,
            paymentMethod: 'CASH',
            status: 'COMPLETED',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique phone numbers for customers', async () => {
      const phoneNumber = '+2693456789';

      await prisma.customer.create({
        data: {
          phoneNumber,
          name: 'First Customer',
        },
      });

      await expect(
        prisma.customer.create({
          data: {
            phoneNumber,
            name: 'Second Customer',
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce unique phone numbers for drivers', async () => {
      const phoneNumber = '+2693543210';

      await prisma.driver.create({
        data: {
          phoneNumber,
          name: 'First Driver',
          licenseNumber: 'KM2024010',
          vehicleType: 'SUV',
          vehiclePlate: 'XX-010-KM',
          zones: ['Moroni'],
        },
      });

      await expect(
        prisma.driver.create({
          data: {
            phoneNumber,
            name: 'Second Driver',
            licenseNumber: 'KM2024011',
            vehicleType: 'Sedan',
            vehiclePlate: 'YY-011-KM',
            zones: ['Mutsamudu'],
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce unique license numbers for drivers', async () => {
      const licenseNumber = 'KM2024020';

      await prisma.driver.create({
        data: {
          phoneNumber: '+2693111111',
          name: 'First Driver',
          licenseNumber,
          vehicleType: 'Minibus',
          vehiclePlate: 'AA-020-KM',
          zones: ['Fomboni'],
        },
      });

      await expect(
        prisma.driver.create({
          data: {
            phoneNumber: '+2693222222',
            name: 'Second Driver',
            licenseNumber,
            vehicleType: 'Sedan',
            vehiclePlate: 'BB-021-KM',
            zones: ['Moroni'],
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce unique booking per trip', async () => {
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

      // Try to create another trip for the same booking
      await expect(
        prisma.trip.create({
          data: {
            bookingId: booking.id,
            customerId: testCustomer.id,
            driverId: testDriver.id,
            startTime: new Date(Date.now() - 50 * 60 * 1000),
            endTime: new Date(Date.now() - 20 * 60 * 1000),
            fare: 1200,
          },
        })
      ).rejects.toThrow();
    });

    it('should enforce unique trip per transaction', async () => {
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

      await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: 1500,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
        },
      });

      // Try to create another transaction for the same trip
      await expect(
        prisma.transaction.create({
          data: {
            tripId: trip.id,
            amount: 1500,
            paymentMethod: 'ORANGE_MONEY',
            status: 'PENDING',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Cascade Operations', () => {
    it('should handle customer deletion with restrict on bookings', async () => {
      const customer = await prisma.customer.create({
        data: {
          phoneNumber: '+2693111222',
          name: 'Customer to Delete',
        },
      });

      await prisma.booking.create({
        data: {
          customerId: customer.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // Should not be able to delete customer with existing bookings
      await expect(
        prisma.customer.delete({
          where: { id: customer.id },
        })
      ).rejects.toThrow();
    });

    it('should handle driver deletion with SET NULL on bookings', async () => {
      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693333444',
          name: 'Driver to Delete',
          licenseNumber: 'KM2024030',
          vehicleType: 'SUV',
          vehiclePlate: 'DD-030-KM',
          zones: ['Moroni'],
        },
      });

      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: driver.id,
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 60 * 60 * 1000),
          status: 'ACCEPTED',
        },
      });

      expect(booking.driverId).toBe(driver.id);

      // Delete driver
      await prisma.driver.delete({
        where: { id: driver.id },
      });

      // Booking should still exist but driverId should be null
      const updatedBooking = await prisma.booking.findUnique({
        where: { id: booking.id },
      });

      expect(updatedBooking).toBeDefined();
      expect(updatedBooking?.driverId).toBeNull();
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity across complete workflow', async () => {
      // Create booking
      const booking = await prisma.booking.create({
        data: {
          customerId: testCustomer.id,
          driverId: testDriver.id,
          pickupAddress: 'Place de France',
          dropAddress: 'Aéroport',
          pickupTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
          status: 'COMPLETED',
          estimatedFare: 3000,
        },
      });

      // Create trip
      const trip = await prisma.trip.create({
        data: {
          bookingId: booking.id,
          customerId: testCustomer.id,
          driverId: testDriver.id,
          startTime: new Date(Date.now() - 90 * 60 * 1000),
          endTime: new Date(Date.now() - 60 * 60 * 1000),
          fare: 3200,
          distance: 15.5,
          paymentMethod: 'CASH',
          paymentStatus: 'COMPLETED',
        },
      });

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: 3200,
          paymentMethod: 'CASH',
          status: 'COMPLETED',
        },
      });

      // Verify complete chain of relationships
      const completeBooking = await prisma.booking.findUnique({
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

      expect(completeBooking).toBeDefined();
      expect(completeBooking?.customer.id).toBe(testCustomer.id);
      expect(completeBooking?.driver?.id).toBe(testDriver.id);
      expect(completeBooking?.trip?.id).toBe(trip.id);
      expect(completeBooking?.trip?.transaction?.id).toBe(transaction.id);

      // Verify data consistency
      expect(completeBooking?.customerId).toBe(completeBooking?.trip?.customerId);
      expect(completeBooking?.driverId).toBe(completeBooking?.trip?.driverId);
      expect(completeBooking?.trip?.fare).toBe(completeBooking?.trip?.transaction?.amount);
    });

    it('should prevent orphaned trips', async () => {
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
          fare: 1000,
        },
      });

      // Try to delete booking with existing trip (should fail due to restrict)
      await expect(
        prisma.booking.delete({
          where: { id: booking.id },
        })
      ).rejects.toThrow();

      // Trip should still exist
      const existingTrip = await prisma.trip.findUnique({
        where: { id: trip.id },
      });
      expect(existingTrip).toBeDefined();
    });

    it('should prevent orphaned transactions', async () => {
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
          fare: 1200,
        },
      });

      const transaction = await prisma.transaction.create({
        data: {
          tripId: trip.id,
          amount: 1200,
          paymentMethod: 'ORANGE_MONEY',
          status: 'COMPLETED',
        },
      });

      // Try to delete trip with existing transaction (should fail due to restrict)
      await expect(
        prisma.trip.delete({
          where: { id: trip.id },
        })
      ).rejects.toThrow();

      // Transaction should still exist
      const existingTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(existingTransaction).toBeDefined();
    });
  });

  describe('Index Performance', () => {
    beforeEach(async () => {
      // Create multiple records for performance testing
      const customers = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.customer.create({
            data: {
              phoneNumber: `+269333${String(i).padStart(4, '0')}`,
              name: `Customer ${i}`,
            },
          })
        )
      );

      const drivers = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          prisma.driver.create({
            data: {
              phoneNumber: `+269444${String(i).padStart(4, '0')}`,
              name: `Driver ${i}`,
              licenseNumber: `KM2024${String(i + 100)}`,
              vehicleType: 'Sedan',
              vehiclePlate: `XX-${String(i + 100)}-KM`,
              zones: ['Moroni'],
              isAvailable: i % 2 === 0,
              isOnline: i % 3 === 0,
              isVerified: true,
            },
          })
        )
      );

      // Create bookings
      await Promise.all(
        customers.slice(0, 5).map((customer, i) =>
          prisma.booking.create({
            data: {
              customerId: customer.id,
              driverId: i < drivers.length ? drivers[i].id : null,
              pickupAddress: `Pickup ${i}`,
              dropAddress: `Drop ${i}`,
              pickupTime: new Date(Date.now() + i * 60 * 60 * 1000),
              status: i % 2 === 0 ? 'PENDING' : 'ACCEPTED',
            },
          })
        )
      );
    });

    it('should efficiently query by customer phone number', async () => {
      const startTime = Date.now();
      
      const customer = await prisma.customer.findUnique({
        where: { phoneNumber: '+2693330001' },
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(customer).toBeDefined();
      expect(queryTime).toBeLessThan(100); // Should be very fast with index
    });

    it('should efficiently query drivers by availability and verification', async () => {
      const startTime = Date.now();
      
      const availableDrivers = await prisma.driver.findMany({
        where: {
          isAvailable: true,
          isVerified: true,
        },
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(availableDrivers.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(100); // Should be fast with composite index
    });

    it('should efficiently query bookings by status and pickup time', async () => {
      const startTime = Date.now();
      
      const futureBookings = await prisma.booking.findMany({
        where: {
          status: 'PENDING',
          pickupTime: {
            gte: new Date(),
          },
        },
        orderBy: {
          pickupTime: 'asc',
        },
      });
      
      const queryTime = Date.now() - startTime;
      
      expect(queryTime).toBeLessThan(100); // Should be fast with composite index
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent booking creation', async () => {
      const concurrentBookings = Array.from({ length: 5 }, (_, i) =>
        prisma.booking.create({
          data: {
            customerId: testCustomer.id,
            pickupAddress: `Concurrent Pickup ${i}`,
            dropAddress: `Concurrent Drop ${i}`,
            pickupTime: new Date(Date.now() + (i + 1) * 60 * 60 * 1000),
          },
        })
      );

      const results = await Promise.all(concurrentBookings);
      
      expect(results).toHaveLength(5);
      results.forEach(booking => {
        expect(booking.id).toBeDefined();
        expect(booking.customerId).toBe(testCustomer.id);
      });
    });

    it('should handle concurrent driver availability updates', async () => {
      const drivers = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          prisma.driver.create({
            data: {
              phoneNumber: `+269555${String(i).padStart(4, '0')}`,
              name: `Concurrent Driver ${i}`,
              licenseNumber: `KM2024${String(i + 200)}`,
              vehicleType: 'SUV',
              vehiclePlate: `CC-${String(i + 200)}-KM`,
              zones: ['Moroni'],
              isAvailable: true,
            },
          })
        )
      );

      // Concurrent availability updates
      const updates = drivers.map(driver =>
        prisma.driver.update({
          where: { id: driver.id },
          data: {
            isAvailable: false,
            lastSeenAt: new Date(),
          },
        })
      );

      const results = await Promise.all(updates);
      
      expect(results).toHaveLength(3);
      results.forEach(driver => {
        expect(driver.isAvailable).toBe(false);
        expect(driver.lastSeenAt).toBeDefined();
      });
    });
  });
});
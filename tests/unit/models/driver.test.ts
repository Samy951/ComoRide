import { PrismaClient } from '@prisma/client';
import { validateComorianPhone, validateCoordinates, SUPPORTED_ZONES } from '../../../src/utils/validation';

const prisma = new PrismaClient();

describe('Driver Model', () => {
  beforeAll(async () => {
    // Clean test data
    await prisma.transaction.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.driver.deleteMany();
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
    await prisma.driver.deleteMany();
  });

  describe('Driver Creation', () => {
    it('should create a driver with all required fields', async () => {
      const driverData = {
        phoneNumber: '+2693398765',
        name: 'Ahmed Soilihi',
        licenseNumber: 'KM2024001',
        vehicleType: 'Sedan Toyota',
        vehiclePlate: 'AB-123-KM',
        rating: 4.7,
        zones: ['Moroni', 'Iconi'],
        isVerified: true,
      };

      const driver = await prisma.driver.create({
        data: driverData,
      });

      expect(driver).toBeDefined();
      expect(driver.phoneNumber).toBe(driverData.phoneNumber);
      expect(driver.name).toBe(driverData.name);
      expect(driver.licenseNumber).toBe(driverData.licenseNumber);
      expect(driver.vehicleType).toBe(driverData.vehicleType);
      expect(driver.vehiclePlate).toBe(driverData.vehiclePlate);
      expect(driver.rating).toBe(driverData.rating);
      expect(driver.zones).toEqual(driverData.zones);
      expect(driver.isVerified).toBe(true);
      expect(driver.isAvailable).toBe(true); // default
      expect(driver.isOnline).toBe(false); // default
    });

    it('should create driver with default values', async () => {
      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693387654',
          name: 'Moussa Ali',
          licenseNumber: 'KM2024002',
          vehicleType: 'SUV',
          vehiclePlate: 'CD-456-KM',
          zones: ['Moroni'],
        },
      });

      expect(driver.rating).toBe(5.0);
      expect(driver.isAvailable).toBe(true);
      expect(driver.isOnline).toBe(false);
      expect(driver.isVerified).toBe(false);
      expect(driver.currentLat).toBeNull();
      expect(driver.currentLng).toBeNull();
      expect(driver.lastSeenAt).toBeNull();
    });

    it('should fail to create driver with duplicate phone number', async () => {
      const phoneNumber = '+2693376543';
      
      await prisma.driver.create({
        data: {
          phoneNumber,
          name: 'Driver 1',
          licenseNumber: 'KM2024003',
          vehicleType: 'Minibus',
          vehiclePlate: 'EF-789-KM',
          zones: ['Moroni'],
        },
      });

      await expect(
        prisma.driver.create({
          data: {
            phoneNumber,
            name: 'Driver 2',
            licenseNumber: 'KM2024004',
            vehicleType: 'Sedan',
            vehiclePlate: 'GH-012-KM',
            zones: ['Mutsamudu'],
          },
        })
      ).rejects.toThrow();
    });

    it('should fail to create driver with duplicate license number', async () => {
      const licenseNumber = 'KM2024005';
      
      await prisma.driver.create({
        data: {
          phoneNumber: '+2693365432',
          name: 'Driver 1',
          licenseNumber,
          vehicleType: 'Sedan',
          vehiclePlate: 'IJ-345-KM',
          zones: ['Fomboni'],
        },
      });

      await expect(
        prisma.driver.create({
          data: {
            phoneNumber: '+2693354321',
            name: 'Driver 2',
            licenseNumber,
            vehicleType: 'SUV',
            vehiclePlate: 'KL-678-KM',
            zones: ['Moroni'],
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Driver Status Management', () => {
    it('should update driver online status', async () => {
      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693343210',
          name: 'Hassan Said',
          licenseNumber: 'KM2024006',
          vehicleType: 'Minibus',
          vehiclePlate: 'MN-901-KM',
          zones: ['Moroni'],
        },
      });

      expect(driver.isOnline).toBe(false);

      const updatedDriver = await prisma.driver.update({
        where: { id: driver.id },
        data: { 
          isOnline: true,
          lastSeenAt: new Date(),
        },
      });

      expect(updatedDriver.isOnline).toBe(true);
      expect(updatedDriver.lastSeenAt).toBeDefined();
    });

    it('should update driver availability', async () => {
      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693332109',
          name: 'Ali Ibrahim',
          licenseNumber: 'KM2024007',
          vehicleType: 'Sedan',
          vehiclePlate: 'OP-234-KM',
          zones: ['Mitsamiouli'],
          isAvailable: true,
        },
      });

      const updatedDriver = await prisma.driver.update({
        where: { id: driver.id },
        data: { isAvailable: false },
      });

      expect(updatedDriver.isAvailable).toBe(false);
    });

    it('should update driver GPS coordinates', async () => {
      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693321098',
          name: 'Said Mohamed',
          licenseNumber: 'KM2024008',
          vehicleType: 'SUV',
          vehiclePlate: 'QR-567-KM',
          zones: ['Mbeni'],
        },
      });

      const moroniLat = -11.7042;
      const moroniLng = 43.2402;

      const updatedDriver = await prisma.driver.update({
        where: { id: driver.id },
        data: {
          currentLat: moroniLat,
          currentLng: moroniLng,
          lastSeenAt: new Date(),
        },
      });

      expect(updatedDriver.currentLat).toBe(moroniLat);
      expect(updatedDriver.currentLng).toBe(moroniLng);
      expect(validateCoordinates(moroniLat, moroniLng)).toBe(true);
    });
  });

  describe('Driver Zones Validation', () => {
    it('should accept valid Comorian zones', () => {
      const validZones = ['Moroni', 'Mutsamudu', 'Fomboni', 'Iconi', 'Mitsamiouli', 'Mbeni', 'Foumbouni'];
      
      validZones.forEach(zone => {
        expect(SUPPORTED_ZONES.includes(zone as any)).toBe(true);
      });
    });

    it('should create driver with multiple zones', async () => {
      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693987654',
          name: 'Multi Zone Driver',
          licenseNumber: 'KM2024009',
          vehicleType: 'SUV',
          vehiclePlate: 'ST-890-KM',
          zones: ['Moroni', 'Iconi', 'Foumbouni', 'Mitsamiouli'],
          isVerified: true,
        },
      });

      expect(driver.zones).toHaveLength(4);
      expect(driver.zones).toContain('Moroni');
      expect(driver.zones).toContain('Mitsamiouli');
    });
  });

  describe('Driver Queries', () => {
    beforeEach(async () => {
      // Create test drivers
      await prisma.driver.createMany({
        data: [
          {
            phoneNumber: '+2693111111',
            name: 'Driver Online Available',
            licenseNumber: 'KM2024010',
            vehicleType: 'Sedan',
            vehiclePlate: 'AA-111-KM',
            zones: ['Moroni'],
            isAvailable: true,
            isOnline: true,
            isVerified: true,
            currentLat: -11.7042,
            currentLng: 43.2402,
            lastSeenAt: new Date(),
          },
          {
            phoneNumber: '+2693222222',
            name: 'Driver Offline Available',
            licenseNumber: 'KM2024011',
            vehicleType: 'SUV',
            vehiclePlate: 'BB-222-KM',
            zones: ['Moroni', 'Iconi'],
            isAvailable: true,
            isOnline: false,
            isVerified: true,
            lastSeenAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          },
          {
            phoneNumber: '+2693333333',
            name: 'Driver Online Busy',
            licenseNumber: 'KM2024012',
            vehicleType: 'Minibus',
            vehiclePlate: 'CC-333-KM',
            zones: ['Mutsamudu'],
            isAvailable: false,
            isOnline: true,
            isVerified: true,
            currentLat: -12.1667,
            currentLng: 44.4167,
            lastSeenAt: new Date(),
          },
          {
            phoneNumber: '+2693444444',
            name: 'Driver Unverified',
            licenseNumber: 'KM2024013',
            vehicleType: 'Sedan',
            vehiclePlate: 'DD-444-KM',
            zones: ['Fomboni'],
            isAvailable: true,
            isOnline: true,
            isVerified: false,
          },
        ],
      });
    });

    it('should find available and verified drivers', async () => {
      const drivers = await prisma.driver.findMany({
        where: {
          isAvailable: true,
          isVerified: true,
        },
        orderBy: {
          rating: 'desc',
        },
      });

      expect(drivers).toHaveLength(2);
      expect(drivers.every(d => d.isAvailable && d.isVerified)).toBe(true);
    });

    it('should find online drivers by zone', async () => {
      const moroniDrivers = await prisma.driver.findMany({
        where: {
          isOnline: true,
          isVerified: true,
          zones: {
            has: 'Moroni',
          },
        },
      });

      expect(moroniDrivers).toHaveLength(1);
      expect(moroniDrivers[0].zones).toContain('Moroni');
      expect(moroniDrivers[0].isOnline).toBe(true);
    });

    it('should find drivers with recent activity', async () => {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      const activeDrivers = await prisma.driver.findMany({
        where: {
          lastSeenAt: {
            gte: fifteenMinutesAgo,
          },
          isVerified: true,
        },
      });

      expect(activeDrivers).toHaveLength(2); // Online drivers with recent lastSeenAt
      expect(activeDrivers.every(d => d.lastSeenAt && d.lastSeenAt >= fifteenMinutesAgo)).toBe(true);
    });

    it('should find drivers by GPS proximity (mock)', async () => {
      // This is a basic test - in production you'd use PostGIS or similar
      const moroniLat = -11.7042;
      const moroniLng = 43.2402;
      const tolerance = 0.1; // ~11km radius

      const nearbyDrivers = await prisma.driver.findMany({
        where: {
          currentLat: {
            gte: moroniLat - tolerance,
            lte: moroniLat + tolerance,
          },
          currentLng: {
            gte: moroniLng - tolerance,
            lte: moroniLng + tolerance,
          },
          isOnline: true,
          isVerified: true,
        },
      });

      expect(nearbyDrivers).toHaveLength(1);
      expect(nearbyDrivers[0].currentLat).toBeCloseTo(moroniLat, 2);
      expect(nearbyDrivers[0].currentLng).toBeCloseTo(moroniLng, 2);
    });
  });

  describe('Driver Relations', () => {
    it('should create driver with bookings relation', async () => {
      const customer = await prisma.customer.create({
        data: {
          phoneNumber: '+2693555555',
          name: 'Test Customer',
        },
      });

      const driver = await prisma.driver.create({
        data: {
          phoneNumber: '+2693666666',
          name: 'Test Driver',
          licenseNumber: 'KM2024014',
          vehicleType: 'Sedan',
          vehiclePlate: 'EE-555-KM',
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

      const driverWithBookings = await prisma.driver.findUnique({
        where: { id: driver.id },
        include: { bookings: true },
      });

      expect(driverWithBookings?.bookings).toHaveLength(1);
      expect(driverWithBookings?.bookings[0].id).toBe(booking.id);
    });
  });
});
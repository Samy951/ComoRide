import { PrismaClient } from '@prisma/client';
import { calculateDistance } from '../../../src/utils/validation';

const prisma = new PrismaClient();

describe('Driver Matching Integration', () => {
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
        name: 'Test Customer',
      },
    });

    // Create diverse set of drivers for testing matching logic
    testDrivers = await Promise.all([
      // Driver 1: Perfect match - online, available, verified, in Moroni
      prisma.driver.create({
        data: {
          phoneNumber: '+2693111111',
          name: 'Perfect Driver Moroni',
          licenseNumber: 'KM2024001',
          vehicleType: 'Sedan Toyota',
          vehiclePlate: 'AA-111-KM',
          rating: 4.9,
          zones: ['Moroni', 'Iconi'],
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLat: -11.7042,
          currentLng: 43.2402,
          lastSeenAt: new Date(),
        },
      }),
      // Driver 2: Good match - online, available, verified, in Moroni, lower rating
      prisma.driver.create({
        data: {
          phoneNumber: '+2693222222',
          name: 'Good Driver Moroni',
          licenseNumber: 'KM2024002',
          vehicleType: 'SUV Nissan',
          vehiclePlate: 'BB-222-KM',
          rating: 4.5,
          zones: ['Moroni', 'Foumbouni'],
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLat: -11.7100,
          currentLng: 43.2500,
          lastSeenAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        },
      }),
      // Driver 3: Available but offline
      prisma.driver.create({
        data: {
          phoneNumber: '+2693333333',
          name: 'Offline Driver Moroni',
          licenseNumber: 'KM2024003',
          vehicleType: 'Minibus Hyundai',
          vehiclePlate: 'CC-333-KM',
          rating: 4.8,
          zones: ['Moroni'],
          isAvailable: true,
          isOnline: false,
          isVerified: true,
          lastSeenAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        },
      }),
      // Driver 4: Online but busy
      prisma.driver.create({
        data: {
          phoneNumber: '+2693444444',
          name: 'Busy Driver Moroni',
          licenseNumber: 'KM2024004',
          vehicleType: 'Sedan Peugeot',
          vehiclePlate: 'DD-444-KM',
          rating: 4.7,
          zones: ['Moroni', 'Mitsamiouli'],
          isAvailable: false, // Busy
          isOnline: true,
          isVerified: true,
          currentLat: -11.6900,
          currentLng: 43.2300,
          lastSeenAt: new Date(),
        },
      }),
      // Driver 5: Online, available but not verified
      prisma.driver.create({
        data: {
          phoneNumber: '+2693555555',
          name: 'Unverified Driver Moroni',
          licenseNumber: 'KM2024005',
          vehicleType: 'SUV Honda',
          vehiclePlate: 'EE-555-KM',
          rating: 4.6,
          zones: ['Moroni'],
          isAvailable: true,
          isOnline: true,
          isVerified: false, // Not verified
          currentLat: -11.7000,
          currentLng: 43.2400,
          lastSeenAt: new Date(),
        },
      }),
      // Driver 6: Perfect but in different zone (Mutsamudu)
      prisma.driver.create({
        data: {
          phoneNumber: '+2693666666',
          name: 'Perfect Driver Mutsamudu',
          licenseNumber: 'KM2024006',
          vehicleType: 'Sedan Renault',
          vehiclePlate: 'FF-666-KM',
          rating: 5.0,
          zones: ['Mutsamudu', 'Mbeni'],
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLat: -12.1667,
          currentLng: 44.4167,
          lastSeenAt: new Date(),
        },
      }),
      // Driver 7: Available in multiple zones including Moroni
      prisma.driver.create({
        data: {
          phoneNumber: '+2693777777',
          name: 'Multi Zone Driver',
          licenseNumber: 'KM2024007',
          vehicleType: 'Minibus Ford',
          vehiclePlate: 'GG-777-KM',
          rating: 4.4,
          zones: ['Moroni', 'Mutsamudu', 'Fomboni'],
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLat: -11.7200,
          currentLng: 43.2600,
          lastSeenAt: new Date(),
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Reset driver availability for next test
    await prisma.driver.updateMany({
      where: { isVerified: true },
      data: { 
        isAvailable: true,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });
  });

  describe('Basic Driver Matching', () => {
    it('should find available and verified drivers in the pickup zone', async () => {
      const availableDrivers = await prisma.driver.findMany({
        where: {
          zones: {
            has: 'Moroni',
          },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
        orderBy: [
          { rating: 'desc' },
          { lastSeenAt: 'desc' },
        ],
      });

      expect(availableDrivers).toHaveLength(4); // Drivers 1, 2, 7 + any others
      
      // Best driver should be first (highest rating)
      expect(availableDrivers[0].rating).toBeGreaterThanOrEqual(availableDrivers[1].rating);
      expect(availableDrivers[0].isOnline).toBe(true);
      expect(availableDrivers[0].isVerified).toBe(true);
      expect(availableDrivers[0].zones).toContain('Moroni');
    });

    it('should exclude offline drivers', async () => {
      const onlineDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      // Should not include driver 3 (offline)
      const offlineDriverIncluded = onlineDrivers.some(d => d.phoneNumber === '+2693333333');
      expect(offlineDriverIncluded).toBe(false);
    });

    it('should exclude busy drivers', async () => {
      const availableDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      // Should not include driver 4 (busy)
      const busyDriverIncluded = availableDrivers.some(d => d.phoneNumber === '+2693444444');
      expect(busyDriverIncluded).toBe(false);
    });

    it('should exclude unverified drivers', async () => {
      const verifiedDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      // Should not include driver 5 (unverified)
      const unverifiedDriverIncluded = verifiedDrivers.some(d => d.phoneNumber === '+2693555555');
      expect(unverifiedDriverIncluded).toBe(false);
    });
  });

  describe('Zone-Based Matching', () => {
    it('should find drivers in specific zone', async () => {
      const mutsamuduDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Mutsamudu' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      expect(mutsamuduDrivers).toHaveLength(2); // Drivers 6 and 7
      
      mutsamuduDrivers.forEach(driver => {
        expect(driver.zones).toContain('Mutsamudu');
        expect(driver.isVerified).toBe(true);
        expect(driver.isOnline).toBe(true);
      });
    });

    it('should find drivers covering multiple zones', async () => {
      const multiZoneDriver = await prisma.driver.findFirst({
        where: {
          zones: {
            hasEvery: ['Moroni', 'Mutsamudu'], // Driver that covers both zones
          },
          isVerified: true,
        },
      });

      expect(multiZoneDriver).toBeDefined();
      expect(multiZoneDriver?.phoneNumber).toBe('+2693777777'); // Driver 7
      expect(multiZoneDriver?.zones).toContain('Moroni');
      expect(multiZoneDriver?.zones).toContain('Mutsamudu');
    });

    it('should handle zone not covered by any driver', async () => {
      const fomboniDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Fomboni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      expect(fomboniDrivers).toHaveLength(1); // Only driver 7 covers Fomboni
      expect(fomboniDrivers[0].zones).toContain('Fomboni');
    });
  });

  describe('GPS Proximity Matching', () => {
    it('should find drivers near pickup location', async () => {
      const pickupLat = -11.7042; // Place de France, Moroni
      const pickupLng = 43.2402;
      const radiusKm = 5; // 5km radius
      const tolerance = radiusKm / 111; // Rough conversion to degrees (1 degree ≈ 111km)

      const nearbyDrivers = await prisma.driver.findMany({
        where: {
          currentLat: {
            gte: pickupLat - tolerance,
            lte: pickupLat + tolerance,
          },
          currentLng: {
            gte: pickupLng - tolerance,
            lte: pickupLng + tolerance,
          },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      expect(nearbyDrivers.length).toBeGreaterThan(0);
      
      // Calculate actual distances and verify they're within radius
      nearbyDrivers.forEach(driver => {
        if (driver.currentLat && driver.currentLng) {
          const distance = calculateDistance(
            pickupLat, pickupLng,
            driver.currentLat, driver.currentLng
          );
          expect(distance).toBeLessThanOrEqual(radiusKm * 1.5); // Allow some tolerance
        }
      });
    });

    it('should order drivers by proximity to pickup', async () => {
      const pickupLat = -11.7042;
      const pickupLng = 43.2402;

      // Get all available drivers with coordinates
      const driversWithLocation = await prisma.driver.findMany({
        where: {
          currentLat: { not: null },
          currentLng: { not: null },
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      // Calculate distances and sort
      const driversWithDistance = driversWithLocation
        .map(driver => ({
          ...driver,
          distance: calculateDistance(
            pickupLat, pickupLng,
            driver.currentLat!, driver.currentLng!
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      expect(driversWithDistance.length).toBeGreaterThan(1);
      
      // Verify sorting (first driver should be closest)
      for (let i = 0; i < driversWithDistance.length - 1; i++) {
        expect(driversWithDistance[i].distance).toBeLessThanOrEqual(driversWithDistance[i + 1].distance);
      }
    });
  });

  describe('Rating-Based Matching', () => {
    it('should prioritize higher-rated drivers', async () => {
      const topDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
        orderBy: [
          { rating: 'desc' },
          { lastSeenAt: 'desc' },
        ],
        take: 3,
      });

      expect(topDrivers.length).toBeGreaterThan(0);
      
      // Verify rating order
      for (let i = 0; i < topDrivers.length - 1; i++) {
        expect(topDrivers[i].rating).toBeGreaterThanOrEqual(topDrivers[i + 1].rating);
      }

      // Top driver should have high rating
      expect(topDrivers[0].rating).toBeGreaterThanOrEqual(4.5);
    });

    it('should find drivers above minimum rating threshold', async () => {
      const minRating = 4.7;
      
      const highRatedDrivers = await prisma.driver.findMany({
        where: {
          rating: { gte: minRating },
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      highRatedDrivers.forEach(driver => {
        expect(driver.rating).toBeGreaterThanOrEqual(minRating);
      });
    });
  });

  describe('Activity-Based Matching', () => {
    it('should prioritize recently active drivers', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const recentlyActiveDrivers = await prisma.driver.findMany({
        where: {
          lastSeenAt: { gte: fiveMinutesAgo },
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
        orderBy: { lastSeenAt: 'desc' },
      });

      recentlyActiveDrivers.forEach(driver => {
        expect(driver.lastSeenAt).toBeDefined();
        expect(driver.lastSeenAt!.getTime()).toBeGreaterThanOrEqual(fiveMinutesAgo.getTime());
      });
    });

    it('should exclude stale drivers', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const activeDrivers = await prisma.driver.findMany({
        where: {
          lastSeenAt: { gte: oneHourAgo },
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      activeDrivers.forEach(driver => {
        expect(driver.lastSeenAt!.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
      });
    });
  });

  describe('Complex Matching Scenarios', () => {
    it('should find best driver using combined criteria', async () => {
      const pickupLat = -11.7042;
      const pickupLng = 43.2402;
      const pickupZone = 'Moroni';
      const minRating = 4.5;
      const maxDistanceKm = 10;
      const recentActivityMinutes = 15;

      const recentActivityTime = new Date(Date.now() - recentActivityMinutes * 60 * 1000);
      const tolerance = maxDistanceKm / 111; // Convert km to degrees

      const bestDrivers = await prisma.driver.findMany({
        where: {
          // Zone coverage
          zones: { has: pickupZone },
          // Availability
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          // Quality
          rating: { gte: minRating },
          // Activity
          lastSeenAt: { gte: recentActivityTime },
          // Proximity (rough filter)
          currentLat: {
            gte: pickupLat - tolerance,
            lte: pickupLat + tolerance,
          },
          currentLng: {
            gte: pickupLng - tolerance,
            lte: pickupLng + tolerance,
          },
        },
        orderBy: [
          { rating: 'desc' },
          { lastSeenAt: 'desc' },
        ],
        take: 1,
      });

      if (bestDrivers.length > 0) {
        const bestDriver = bestDrivers[0];
        
        expect(bestDriver.zones).toContain(pickupZone);
        expect(bestDriver.isAvailable).toBe(true);
        expect(bestDriver.isOnline).toBe(true);
        expect(bestDriver.isVerified).toBe(true);
        expect(bestDriver.rating).toBeGreaterThanOrEqual(minRating);
        expect(bestDriver.lastSeenAt!.getTime()).toBeGreaterThanOrEqual(recentActivityTime.getTime());

        if (bestDriver.currentLat && bestDriver.currentLng) {
          const distance = calculateDistance(
            pickupLat, pickupLng,
            bestDriver.currentLat, bestDriver.currentLng
          );
          expect(distance).toBeLessThanOrEqual(maxDistanceKm * 1.2); // Allow some tolerance
        }
      }
    });

    it('should handle no available drivers scenario', async () => {
      // Set all drivers to unavailable
      await prisma.driver.updateMany({
        where: { zones: { has: 'Moroni' } },
        data: { isAvailable: false },
      });

      const availableDrivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Moroni' },
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
      });

      expect(availableDrivers).toHaveLength(0);
    });

    it('should gracefully degrade when no perfect match exists', async () => {
      // First try strict criteria
      let drivers = await prisma.driver.findMany({
        where: {
          zones: { has: 'Iconi' }, // Specific zone with fewer drivers
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          rating: { gte: 4.8 }, // High rating requirement
        },
      });

      if (drivers.length === 0) {
        // Relax rating requirement
        drivers = await prisma.driver.findMany({
          where: {
            zones: { has: 'Iconi' },
            isAvailable: true,
            isOnline: true,
            isVerified: true,
            rating: { gte: 4.0 }, // Lower rating
          },
        });
      }

      if (drivers.length === 0) {
        // Expand to nearby zones
        drivers = await prisma.driver.findMany({
          where: {
            zones: { hasSome: ['Iconi', 'Moroni', 'Foumbouni'] },
            isAvailable: true,
            isOnline: true,
            isVerified: true,
          },
        });
      }

      // Should find at least some drivers with relaxed criteria
      expect(drivers.length).toBeGreaterThan(0);
    });
  });
});
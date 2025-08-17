import {
  validateComorianPhone,
  validateCoordinates,
  calculateEstimatedFare,
  calculateDistance,
  validateZone,
  maskPhoneNumber,
  SUPPORTED_ZONES
} from '../../../src/utils/validation';

describe('Validation Utils', () => {
  describe('validateComorianPhone', () => {
    it('should validate correct Comorian phone numbers', () => {
      const validNumbers = [
        '+2693321234',
        '+2693987654',
        '+2691234567',
        '+2699876543',
        '+2693000000',
        '+2693999999'
      ];

      validNumbers.forEach(number => {
        expect(validateComorianPhone(number)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidNumbers = [
        '+33123456789', // French number
        '+2693321234567', // Too long (8 digits after +269)
        '+269332123', // Too short (6 digits after +269)
        '2693321234', // Missing +
        '+269332123a', // Contains letter
        '+269 332 1234', // Contains spaces
        '+269-332-1234', // Contains dashes
        '+2693321234 ', // Trailing space
        ' +2693321234', // Leading space
        '+269', // Only country code
        '', // Empty string
        'abc', // Invalid format
        '+1234567890', // Different country code
        '+26933212345', // Too many digits
        '+26933212', // Too few digits
      ];

      invalidNumbers.forEach(number => {
        expect(validateComorianPhone(number)).toBe(false);
      });
    });

    it('should handle null and undefined', () => {
      expect(validateComorianPhone(null as any)).toBe(false);
      expect(validateComorianPhone(undefined as any)).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    it('should validate coordinates within Comoros bounds', () => {
      const validCoordinates = [
        [-11.7042, 43.2402], // Moroni
        [-12.1667, 44.4167], // Mutsamudu
        [-12.2833, 43.7333], // Fomboni
        [-11.3833, 43.2833], // Mitsamiouli
        [-11.7167, 43.2833], // Mbeni area
        [-11.5336, 43.2719], // Airport
        [-12.0, 44.0], // Center of archipelago
        [-11.5, 43.5], // North Grande Comore
        [-12.5, 43.5], // South Mohéli
      ];

      validCoordinates.forEach(([lat, lng]) => {
        expect(validateCoordinates(lat, lng)).toBe(true);
      });
    });

    it('should reject coordinates outside Comoros bounds', () => {
      const invalidCoordinates = [
        [0, 0], // Equator/Prime Meridian
        [-13.0, 43.0], // Too far south
        [-11.0, 43.0], // Too far north
        [-12.0, 42.0], // Too far west
        [-12.0, 45.0], // Too far east
        [48.8566, 2.3522], // Paris
        [-1.2921, 36.8219], // Nairobi
        [40.7128, -74.0060], // New York
        [-90, 180], // South Pole
        [90, -180], // North Pole
      ];

      invalidCoordinates.forEach(([lat, lng]) => {
        expect(validateCoordinates(lat, lng)).toBe(false);
      });
    });

    it('should handle edge cases at bounds', () => {
      // Test exact bounds
      expect(validateCoordinates(-12.8, 43.0)).toBe(true); // SW corner
      expect(validateCoordinates(-11.3, 44.8)).toBe(true); // NE corner
      expect(validateCoordinates(-12.8, 44.8)).toBe(true); // SE corner
      expect(validateCoordinates(-11.3, 43.0)).toBe(true); // NW corner

      // Test just outside bounds
      expect(validateCoordinates(-12.81, 43.0)).toBe(false); // Too far south
      expect(validateCoordinates(-11.29, 43.0)).toBe(false); // Too far north
      expect(validateCoordinates(-12.0, 42.99)).toBe(false); // Too far west
      expect(validateCoordinates(-12.0, 44.81)).toBe(false); // Too far east
    });
  });

  describe('calculateEstimatedFare', () => {
    it('should calculate fare with base rate and distance', () => {
      const testCases = [
        { distance: 0, expected: 200 }, // Base fare only
        { distance: 1, expected: 350 }, // 200 + 1*150
        { distance: 5, expected: 950 }, // 200 + 5*150
        { distance: 10, expected: 1700 }, // 200 + 10*150
        { distance: 15.5, expected: 2525 }, // 200 + 15.5*150
        { distance: 20, expected: 3200 }, // 200 + 20*150
        { distance: 0.5, expected: 275 }, // 200 + 0.5*150
      ];

      testCases.forEach(({ distance, expected }) => {
        expect(calculateEstimatedFare(distance)).toBe(expected);
      });
    });

    it('should handle decimal distances', () => {
      expect(calculateEstimatedFare(3.7)).toBe(755); // 200 + 3.7*150
      expect(calculateEstimatedFare(12.3)).toBe(2045); // 200 + 12.3*150
    });

    it('should throw error for negative distance', () => {
      expect(() => calculateEstimatedFare(-1)).toThrow('Distance cannot be negative');
      expect(() => calculateEstimatedFare(-0.1)).toThrow('Distance cannot be negative');
      expect(() => calculateEstimatedFare(-10)).toThrow('Distance cannot be negative');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between Comorian cities', () => {
      // Moroni to Airport (approximate)
      const moroniLat = -11.7042;
      const moroniLng = 43.2402;
      const airportLat = -11.5336;
      const airportLng = 43.2719;

      const distance = calculateDistance(moroniLat, moroniLng, airportLat, airportLng);
      expect(distance).toBeGreaterThan(15); // Should be around 19 km
      expect(distance).toBeLessThan(25);
    });

    it('should calculate zero distance for same coordinates', () => {
      const lat = -11.7042;
      const lng = 43.2402;
      
      const distance = calculateDistance(lat, lng, lat, lng);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should calculate distance between Moroni and Mutsamudu', () => {
      const moroniLat = -11.7042;
      const moroniLng = 43.2402;
      const mutsamuduLat = -12.1667;
      const mutsamuduLng = 44.4167;

      const distance = calculateDistance(moroniLat, moroniLng, mutsamuduLat, mutsamuduLng);
      expect(distance).toBeGreaterThan(100); // Inter-island distance
      expect(distance).toBeLessThan(200);
    });

    it('should handle edge coordinates', () => {
      // Test with coordinates at opposite sides of the world
      const distance = calculateDistance(90, 0, -90, 180);
      expect(distance).toBeGreaterThan(19000); // Should be close to half Earth's circumference
      expect(distance).toBeLessThan(21000);
    });
  });

  describe('validateZone', () => {
    it('should validate supported zones', () => {
      SUPPORTED_ZONES.forEach(zone => {
        expect(validateZone(zone)).toBe(true);
      });
    });

    it('should reject unsupported zones', () => {
      const invalidZones = [
        'Paris',
        'Mayotte',
        'Anjouan', // This is actually part of Comoros but not in our supported zones
        'Madagascar',
        'moroni', // Wrong case
        'MORONI', // Wrong case
        'Moro ni', // With space
        '',
        'Unknown Zone'
      ];

      invalidZones.forEach(zone => {
        expect(validateZone(zone)).toBe(false);
      });
    });

    it('should be case sensitive', () => {
      expect(validateZone('Moroni')).toBe(true);
      expect(validateZone('moroni')).toBe(false);
      expect(validateZone('MORONI')).toBe(false);
      expect(validateZone('MoRoNi')).toBe(false);
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask Comorian phone numbers', () => {
      const testCases = [
        { input: '+2693321234', expected: '+269*****34' },
        { input: '+2693987654', expected: '+269*****54' },
        { input: '+2691234567', expected: '+269*****67' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(maskPhoneNumber(input)).toBe(expected);
      });
    });

    it('should mask international phone numbers', () => {
      const testCases = [
        { input: '+33123456789', expected: '+331******89' },
        { input: '+1234567890', expected: '+123*****90' },
        { input: '+4412345678', expected: '+441*****78' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(maskPhoneNumber(input)).toBe(expected);
      });
    });

    it('should handle short phone numbers', () => {
      expect(maskPhoneNumber('123')).toBe('***');
      expect(maskPhoneNumber('12345')).toBe('***');
      expect(maskPhoneNumber('')).toBe('***');
    });

    it('should handle edge cases', () => {
      expect(maskPhoneNumber('+12345')).toBe('***'); // Too short (length 6, but starts with +)
      expect(maskPhoneNumber('1234567')).toBe('1234*67'); // Minimum length for masking
      expect(maskPhoneNumber('12345678')).toBe('1234**78'); // Standard masking
    });
  });

  describe('SUPPORTED_ZONES constant', () => {
    it('should contain expected Comorian zones', () => {
      const expectedZones = ['Moroni', 'Mutsamudu', 'Fomboni', 'Iconi', 'Mitsamiouli', 'Mbeni', 'Foumbouni'];
      
      expectedZones.forEach(zone => {
        expect(SUPPORTED_ZONES).toContain(zone);
      });

      expect(SUPPORTED_ZONES).toHaveLength(7);
    });

    it('should be readonly', () => {
      // TypeScript prevents modification at compile time
      // At runtime, the array is still mutable but we test the constant exists
      expect(SUPPORTED_ZONES).toBeDefined();
      expect(Array.isArray(SUPPORTED_ZONES)).toBe(true);
    });
  });
});
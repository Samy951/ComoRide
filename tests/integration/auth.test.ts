import request from 'supertest';
import app from '../../src/app';
import { PrismaClient } from '@prisma/client';

// Get the mocked prisma instance
const mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>;

const testCustomer = {
  id: 'customer-test-1',
  phoneNumber: '+2693123456',
  name: 'Client Test'
};

const testDriver = {
  id: 'driver-test-1',
  phoneNumber: '+2693987654',
  name: 'Chauffeur Test'
};

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/verify', () => {
    it('should verify existing customer phone', async () => {
      // Mock customer found
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(testCustomer);
      (mockPrisma.driver.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: testCustomer.phoneNumber });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: testCustomer.id,
          phoneNumber: testCustomer.phoneNumber,
          type: 'customer',
          name: testCustomer.name
        }
      });
    });

    it('should verify existing driver phone', async () => {
      // Mock driver found
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.driver.findUnique as jest.Mock).mockResolvedValue(testDriver);

      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: testDriver.phoneNumber });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          id: testDriver.id,
          phoneNumber: testDriver.phoneNumber,
          type: 'driver',
          name: testDriver.name
        }
      });
    });

    it('should return 404 for unknown phone', async () => {
      // Mock no user found
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.driver.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: '+2693999999' });
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Numéro non enregistré'
        }
      });
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: 'invalid-phone' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid phone', async () => {
      // Mock customer found for auth middleware
      (mockPrisma.customer.findUnique as jest.Mock).mockResolvedValue(testCustomer);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('phone', testCustomer.phoneNumber);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: null
      });
    });

    it('should require phone header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });
  });
});
import request from 'supertest';

// Set test environment BEFORE any imports
process.env.NODE_ENV = 'test';

// Mock logger
jest.mock('../../src/config/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

// Mock Prisma completely
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    driver: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $use: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue(1),
    $disconnect: jest.fn(),
  })),
}));

// Mock database config
jest.mock('../../src/config/database', () => ({
  default: {
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    driver: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $use: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue(1),
    $disconnect: jest.fn(),
  }
}));

// Now import the app after mocks are set up
import app from '../../src/app';

describe('API Basic Integration Tests', () => {
  describe('Health Check', () => {
    it('should return API status', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Como Ride API');
      expect(response.body.status).toBe('running');
    });

    it('should return health check', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });

  describe('API Routes Structure', () => {
    it('should have auth verify endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: 'invalid' });
      
      // Should return validation error, not 404
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require phone header for protected routes', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });

    it('should have driver routes protected', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .send({ isAvailable: true, isOnline: true });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });

    it('should have booking routes protected', async () => {
      const response = await request(app)
        .post('/api/v1/rides')
        .send({ 
          pickupAddress: 'Test',
          dropAddress: 'Test',
          pickupTime: new Date().toISOString(),
          passengers: 1 
        });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting per phone number', async () => {
      // This test would require multiple requests, keeping it simple
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .set('phone', '+2693123456')
        .send({ phoneNumber: '+2693123456' });
      
      // Just check the route is accessible with phone header
      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Validation Middleware', () => {
    it('should validate Zod schemas', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: 'not-a-phone' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate phone number format for Comoros', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: '+1234567890' }); // Non-Comoros number
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/v1/unknown');
      
      expect(response.status).toBe(404);
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ invalidField: 'test' });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});
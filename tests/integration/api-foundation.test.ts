// Mock database AVANT tout import
jest.mock('../../src/config/database', () => ({
  default: {
    $use: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue(1),
    customer: { findUnique: jest.fn() },
    driver: { findUnique: jest.fn() },
    booking: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  }
}));

// Mock logger
jest.mock('../../src/config/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }
}));

import request from 'supertest';
import app from '../../src/app';

describe('TICKET-003: API Foundation', () => {
  
  describe('✅ Health & Basic Routes', () => {
    it('should return API status', async () => {
      const response = await request(app).get('/');
      console.log('Response status:', response.status);
      console.log('Response body:', response.body);
      
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

  describe('✅ Auth Routes Structure', () => {
    it('should have auth/verify endpoint with validation', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: 'invalid-phone' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate Comoros phone format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: '+1234567890' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should require phone header for logout', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout');
      
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'MISSING_PHONE',
          message: 'Numéro de téléphone requis'
        }
      });
    });
  });

  describe('✅ Driver Routes Protection', () => {
    it('should protect driver/availability route', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .send({ isAvailable: true, isOnline: true });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });

    it('should protect driver/location route', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/location')
        .send({ latitude: -11.6455, longitude: 43.3344 });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });
  });

  describe('✅ Booking Routes Protection', () => {
    it('should protect rides creation', async () => {
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

    it('should protect rides details', async () => {
      const response = await request(app)
        .get('/api/v1/rides/test-id');
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });
  });

  describe('✅ Validation Middleware', () => {
    it('should validate booking creation data', async () => {
      const response = await request(app)
        .post('/api/v1/rides')
        .set('phone', '+2693123456')
        .send({ invalidData: 'test' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate driver availability data', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .set('phone', '+2693123456')
        .send({ invalidField: 'test' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('✅ Rate Limiting Structure', () => {
    it('should accept requests with phone header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .set('phone', '+2693123456')
        .send({ phoneNumber: '+2693123456' });
      
      // Should not be rate limited, should fail on auth or validation
      expect([400, 401, 404]).toContain(response.status);
    });
  });

  describe('✅ Error Format Consistency', () => {
    it('should return consistent error format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/verify')
        .send({ phoneNumber: 'invalid' });
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent');
      
      expect(response.status).toBe(404);
    });
  });
});
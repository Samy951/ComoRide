import request from 'supertest';
import app from '../../src/app';
import { testDriver, testCustomer } from '../fixtures/test-data';

describe('Driver API', () => {
  describe('PUT /api/v1/drivers/availability', () => {
    it('should update driver availability', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .set('phone', testDriver.phoneNumber)
        .send({
          isAvailable: true,
          isOnline: true,
          zones: ['Moroni', 'Mitsamiouli']
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isAvailable).toBe(true);
      expect(response.body.data.isOnline).toBe(true);
      expect(response.body.data.zones).toEqual(['Moroni', 'Mitsamiouli']);
      expect(response.body.data.lastSeenAt).toBeDefined();
    });

    it('should reject customer access', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .set('phone', testCustomer.phoneNumber)
        .send({ isAvailable: true, isOnline: true });
      
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DRIVER_REQUIRED');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .send({ isAvailable: true, isOnline: true });
      
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_PHONE');
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/availability')
        .set('phone', testDriver.phoneNumber)
        .send({ isAvailable: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/drivers/location', () => {
    it('should update driver location', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/location')
        .set('phone', testDriver.phoneNumber)
        .send({
          latitude: -11.6455,
          longitude: 43.3344
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.latitude).toBe(-11.6455);
      expect(response.body.data.longitude).toBe(43.3344);
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it('should validate latitude range', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/location')
        .set('phone', testDriver.phoneNumber)
        .send({
          latitude: 95, // Invalid latitude
          longitude: 43.3344
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate longitude range', async () => {
      const response = await request(app)
        .put('/api/v1/drivers/location')
        .set('phone', testDriver.phoneNumber)
        .send({
          latitude: -11.6455,
          longitude: 185 // Invalid longitude
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
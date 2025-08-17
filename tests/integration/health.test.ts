import request from 'supertest';
import app from '@/app';

describe('Health Check Endpoint', () => {
  describe('GET /api/v1/health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
    });

    it('should have correct content-type', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /', () => {
    it('should return API info', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Como Ride API');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('status', 'running');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('status', 'error');
      expect(response.body).toHaveProperty('message');
    });
  });
});
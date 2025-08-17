import request from 'supertest';
import app from '../../src/app';
import { testCustomer, testDriver } from '../fixtures/test-data';

describe('Booking Flow', () => {
  it('should complete full booking cycle', async () => {
    // 1. Customer creates booking
    const createResponse = await request(app)
      .post('/api/v1/rides')
      .set('phone', testCustomer.phoneNumber)
      .send({
        pickupAddress: 'Place de France, Moroni',
        dropAddress: 'Aéroport Prince Said Ibrahim',
        pickupTime: new Date(Date.now() + 3600000).toISOString(),
        passengers: 2
      });
    
    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.status).toBe('PENDING');
    expect(createResponse.body.data.pickupAddress).toBe('Place de France, Moroni');
    
    const bookingId = createResponse.body.data.id;

    // 2. Driver accepts booking
    const acceptResponse = await request(app)
      .put(`/api/v1/rides/${bookingId}/accept`)
      .set('phone', testDriver.phoneNumber)
      .send({ estimatedFare: 5000 });
    
    expect(acceptResponse.status).toBe(200);
    expect(acceptResponse.body.success).toBe(true);
    expect(acceptResponse.body.data.status).toBe('ACCEPTED');
    expect(acceptResponse.body.data.estimatedFare).toBe(5000);
    expect(acceptResponse.body.data.driver).toBeDefined();

    // 3. Verify booking details
    const detailsResponse = await request(app)
      .get(`/api/v1/rides/${bookingId}`)
      .set('phone', testCustomer.phoneNumber);
    
    expect(detailsResponse.status).toBe(200);
    expect(detailsResponse.body.success).toBe(true);
    expect(detailsResponse.body.data.status).toBe('ACCEPTED');
    expect(detailsResponse.body.data.driver).toBeDefined();
    expect(detailsResponse.body.data.customer.phoneNumber).toBe('+269****56'); // Masked
  });

  describe('POST /api/v1/rides', () => {
    it('should create booking successfully', async () => {
      const response = await request(app)
        .post('/api/v1/rides')
        .set('phone', testCustomer.phoneNumber)
        .send({
          pickupAddress: 'Moroni Centre',
          dropAddress: 'Université des Comores',
          pickupTime: new Date(Date.now() + 3600000).toISOString(),
          passengers: 1,
          notes: 'Urgent'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pickupAddress).toBe('Moroni Centre');
      expect(response.body.data.dropAddress).toBe('Université des Comores');
      expect(response.body.data.passengers).toBe(1);
    });

    it('should reject driver creating booking', async () => {
      const response = await request(app)
        .post('/api/v1/rides')
        .set('phone', testDriver.phoneNumber)
        .send({
          pickupAddress: 'Test',
          dropAddress: 'Test',
          pickupTime: new Date().toISOString(),
          passengers: 1
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CUSTOMER_REQUIRED');
    });

    it('should validate pickup time', async () => {
      const response = await request(app)
        .post('/api/v1/rides')
        .set('phone', testCustomer.phoneNumber)
        .send({
          pickupAddress: 'Test',
          dropAddress: 'Test',
          pickupTime: 'invalid-date',
          passengers: 1
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate passenger count', async () => {
      const response = await request(app)
        .post('/api/v1/rides')
        .set('phone', testCustomer.phoneNumber)
        .send({
          pickupAddress: 'Test',
          dropAddress: 'Test',
          pickupTime: new Date().toISOString(),
          passengers: 10 // Too many
        });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/rides/:id/cancel', () => {
    it('should cancel booking successfully', async () => {
      // Create booking first
      const createResponse = await request(app)
        .post('/api/v1/rides')
        .set('phone', testCustomer.phoneNumber)
        .send({
          pickupAddress: 'Test Pickup',
          dropAddress: 'Test Drop',
          pickupTime: new Date(Date.now() + 3600000).toISOString(),
          passengers: 1
        });
      
      const bookingId = createResponse.body.data.id;

      // Cancel booking
      const cancelResponse = await request(app)
        .put(`/api/v1/rides/${bookingId}/cancel`)
        .set('phone', testCustomer.phoneNumber)
        .send({ reason: 'Plans changed' });
      
      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.status).toBe('CANCELLED');
      expect(cancelResponse.body.data.cancellationReason).toBe('Plans changed');
    });

    it('should require cancellation reason', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rides')
        .set('phone', testCustomer.phoneNumber)
        .send({
          pickupAddress: 'Test',
          dropAddress: 'Test',
          pickupTime: new Date(Date.now() + 3600000).toISOString(),
          passengers: 1
        });
      
      const bookingId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/rides/${bookingId}/cancel`)
        .set('phone', testCustomer.phoneNumber)
        .send({ reason: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/rides/:id', () => {
    it('should return 404 for non-existent booking', async () => {
      const response = await request(app)
        .get('/api/v1/rides/non-existent-id')
        .set('phone', testCustomer.phoneNumber);
      
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
    });
  });

  describe('PUT /api/v1/rides/:id/accept', () => {
    it('should reject customer accepting booking', async () => {
      const createResponse = await request(app)
        .post('/api/v1/rides')
        .set('phone', testCustomer.phoneNumber)
        .send({
          pickupAddress: 'Test',
          dropAddress: 'Test',
          pickupTime: new Date(Date.now() + 3600000).toISOString(),
          passengers: 1
        });
      
      const bookingId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/rides/${bookingId}/accept`)
        .set('phone', testCustomer.phoneNumber)
        .send({});
      
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DRIVER_REQUIRED');
    });
  });
});
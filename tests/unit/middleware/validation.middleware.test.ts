import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('validateBody', () => {
    it('should pass validation with valid body', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockReq.body = { name: 'John', age: 25 };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'John', age: 25 });
    });

    it('should fail validation with invalid body', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockReq.body = { name: 'John', age: 'invalid' };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateQuery', () => {
    it('should pass validation with valid query', () => {
      const schema = z.object({
        page: z.string().transform(Number),
        limit: z.string().transform(Number),
      });

      mockReq.query = { page: '1', limit: '10' };

      const middleware = validateQuery(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: 1, limit: 10 });
    });
  });

  describe('validateParams', () => {
    it('should pass validation with valid params', () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateParams(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation with invalid params', () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = { id: 'invalid-uuid' };

      const middleware = validateParams(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
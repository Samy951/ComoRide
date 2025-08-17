import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiResponse } from '../types/api.types';

export const phoneRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes par numéro
  keyGenerator: (req: Request) => (req.headers.phone as string) || req.ip || 'unknown',
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Trop de requêtes, veuillez patienter"
    }
  } as ApiResponse<null>,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Trop de requêtes, veuillez patienter"
      }
    } as ApiResponse<null>);
  }
});
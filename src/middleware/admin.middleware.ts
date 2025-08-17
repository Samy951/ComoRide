import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminRequest, ApiResponse } from '../types/api.types';

interface AdminJWTPayload {
  id: string;
  role: 'admin';
  iat: number;
  exp: number;
}

export const requireAdmin = async (
  req: AdminRequest,
  res: Response<ApiResponse<any>>,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: "MISSING_TOKEN",
        message: "Token d'authentification requis"
      }
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer '
  
  try {
    const secretAdmin = process.env.JWT_SECRET_ADMIN || process.env.JWT_SECRET || 'admin-secret-fallback';
    const decoded = jwt.verify(token, secretAdmin) as AdminJWTPayload;
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: "INVALID_ROLE",
          message: "Accès réservé aux administrateurs"
        }
      });
    }

    req.admin = {
      id: decoded.id,
      role: decoded.role
    };
    
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "Token invalide ou expiré"
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Erreur d'authentification"
      }
    });
  }
};
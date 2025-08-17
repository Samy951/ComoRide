import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, ApiResponse } from '../types/api.types';
import { AuthService } from '../services/auth.service';

export const requireAuth = async (
  req: AuthenticatedRequest, 
  res: Response<ApiResponse<any>>, 
  next: NextFunction
) => {
  const phone = req.headers.phone as string;
  
  if (!phone) {
    return res.status(401).json({
      success: false,
      error: {
        code: "MISSING_PHONE",
        message: "Numéro de téléphone requis"
      }
    });
  }

  try {
    const user = await AuthService.findUserByPhone(phone);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Utilisateur non autorisé"
        }
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Erreur d'authentification"
      }
    });
  }
};

export const requireDriver = (
  req: AuthenticatedRequest, 
  res: Response<ApiResponse<any>>, 
  next: NextFunction
) => {
  if (req.user.type !== "driver") {
    return res.status(403).json({
      success: false,
      error: {
        code: "DRIVER_REQUIRED",
        message: "Accès réservé aux chauffeurs"
      }
    });
  }
  return next();
};

export const requireCustomer = (
  req: AuthenticatedRequest, 
  res: Response<ApiResponse<any>>, 
  next: NextFunction
) => {
  if (req.user.type !== "customer") {
    return res.status(403).json({
      success: false,
      error: {
        code: "CUSTOMER_REQUIRED", 
        message: "Accès réservé aux clients"
      }
    });
  }
  return next();
};
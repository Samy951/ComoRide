import { Request, Response } from 'express';
import { AuthenticatedRequest, ApiResponse, VerifyResponse } from '../types/api.types';
import { AuthService } from '../services/auth.service';
import { validateBody } from '../middleware/validation.middleware';
import { verifySchema } from '../schemas/auth.schemas';

export class AuthController {
  static verify = [
    validateBody(verifySchema),
    async (req: Request, res: Response<ApiResponse<VerifyResponse>>) => {
      try {
        const { phoneNumber } = req.body;
        
        const user = await AuthService.findUserByPhone(phoneNumber);
        
        if (!user) {
          return res.status(404).json({
            success: false,
            error: {
              code: "USER_NOT_FOUND",
              message: "Numéro non enregistré"
            }
          });
        }

        return res.status(200).json({
          success: true,
          data: user
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur interne du serveur"
          }
        });
      }
    }
  ];

  static logout = async (_req: AuthenticatedRequest, res: Response<ApiResponse<null>>) => {
    return res.status(200).json({
      success: true,
      data: null
    });
  };
}
import { Response } from 'express';
import { AuthenticatedRequest, ApiResponse, AvailabilityResponse, LocationResponse } from '../types/api.types';
import { DriverService } from '../services/driver.service';
import { validateBody } from '../middleware/validation.middleware';
import { availabilitySchema, locationSchema } from '../schemas/driver.schemas';

export class DriverController {
  static updateAvailability = [
    validateBody(availabilitySchema),
    async (req: AuthenticatedRequest, res: Response<ApiResponse<AvailabilityResponse>>) => {
      try {
        const data = await DriverService.updateAvailability(req.user.id, req.body);
        
        res.status(200).json({
          success: true,
          data
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la mise à jour"
          }
        });
      }
    }
  ];

  static updateLocation = [
    validateBody(locationSchema),
    async (req: AuthenticatedRequest, res: Response<ApiResponse<LocationResponse>>) => {
      try {
        const data = await DriverService.updateLocation(req.user.id, req.body);
        
        res.status(200).json({
          success: true,
          data
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la mise à jour de position"
          }
        });
      }
    }
  ];
}
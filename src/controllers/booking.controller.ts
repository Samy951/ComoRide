import { Response } from 'express';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  BookingResponse, 
  BookingDetailsResponse,
  AcceptBookingResponse,
  CancelBookingResponse
} from '../types/api.types';
import { BookingService } from '../services/booking.service';
import { validateBody } from '../middleware/validation.middleware';
import { createBookingSchema, acceptBookingSchema, cancelBookingSchema } from '../schemas/booking.schemas';

export class BookingController {
  static createBooking = [
    validateBody(createBookingSchema),
    async (req: AuthenticatedRequest, res: Response<ApiResponse<BookingResponse>>) => {
      try {
        const booking = await BookingService.createBooking(req.user.id, req.body);
        
        res.status(201).json({
          success: true,
          data: booking
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de la création de la réservation"
          }
        });
      }
    }
  ];

  static getBooking = async (req: AuthenticatedRequest, res: Response<ApiResponse<BookingDetailsResponse>>): Promise<void> => {
    try {
      const { id } = req.params;
      const booking = await BookingService.getBookingDetails(id);
      
      if (!booking) {
        res.status(404).json({
          success: false,
          error: {
            code: "BOOKING_NOT_FOUND",
            message: "Réservation introuvable"
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: booking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Erreur lors de la récupération de la réservation"
        }
      });
    }
  };

  static acceptBooking = [
    validateBody(acceptBookingSchema),
    async (req: AuthenticatedRequest, res: Response<ApiResponse<AcceptBookingResponse>>) => {
      try {
        const { id } = req.params;
        const result = await BookingService.acceptBooking(id, req.user.id, req.body);
        
        if (!result) {
          res.status(400).json({
            success: false,
            error: {
              code: "BOOKING_NOT_AVAILABLE",
              message: "Réservation non disponible"
            }
          });
          return;
        }

        res.status(200).json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de l'acceptation de la réservation"
          }
        });
      }
    }
  ];

  static cancelBooking = [
    validateBody(cancelBookingSchema),
    async (req: AuthenticatedRequest, res: Response<ApiResponse<CancelBookingResponse>>) => {
      try {
        const { id } = req.params;
        const result = await BookingService.cancelBooking(id, req.body);
        
        if (!result) {
          res.status(400).json({
            success: false,
            error: {
              code: "BOOKING_NOT_CANCELLABLE",
              message: "Réservation non annulable"
            }
          });
          return;
        }

        res.status(200).json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "Erreur lors de l'annulation de la réservation"
          }
        });
      }
    }
  ];
}
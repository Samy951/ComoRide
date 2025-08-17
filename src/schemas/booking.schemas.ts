import { z } from 'zod';

export const createBookingSchema = z.object({
  pickupAddress: z.string().min(1, "Adresse de départ requise"),
  dropAddress: z.string().min(1, "Adresse d'arrivée requise"),
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  dropLat: z.number().min(-90).max(90).optional(),
  dropLng: z.number().min(-180).max(180).optional(),
  pickupTime: z.string().datetime("Date de départ invalide"),
  passengers: z.number().min(1).max(8, "Maximum 8 passagers"),
  notes: z.string().optional()
});

export const acceptBookingSchema = z.object({
  estimatedFare: z.number().min(0).optional()
});

export const cancelBookingSchema = z.object({
  reason: z.string().min(1, "Raison d'annulation requise")
});

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
export type AcceptBookingRequest = z.infer<typeof acceptBookingSchema>;
export type CancelBookingRequest = z.infer<typeof cancelBookingSchema>;
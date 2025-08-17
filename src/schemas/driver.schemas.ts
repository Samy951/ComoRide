import { z } from 'zod';

export const availabilitySchema = z.object({
  isAvailable: z.boolean(),
  isOnline: z.boolean(),
  zones: z.array(z.string()).optional()
});

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export type AvailabilityRequest = z.infer<typeof availabilitySchema>;
export type LocationRequest = z.infer<typeof locationSchema>;
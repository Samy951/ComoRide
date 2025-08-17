import { z } from 'zod';

// Login admin schema
export const loginSchema = z.object({
  password: z.string().min(1, "Mot de passe requis")
});

// Driver creation schema
export const createDriverSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+269\d{7}$/, "Format téléphone invalide (+269XXXXXXX)"),
  name: z.string()
    .min(2, "Nom doit contenir au moins 2 caractères")
    .max(50, "Nom ne peut pas dépasser 50 caractères"),
  licenseNumber: z.string()
    .min(5, "Numéro de permis invalide")
    .max(20, "Numéro de permis trop long"),
  vehicleType: z.enum(["SEDAN", "SUV", "MOTORCYCLE", "VAN"], {
    errorMap: () => ({ message: "Type de véhicule invalide" })
  }),
  vehiclePlate: z.string()
    .min(3, "Plaque d'immatriculation invalide")
    .max(15, "Plaque d'immatriculation trop longue"),
  zones: z.array(z.string())
    .min(1, "Au moins une zone doit être sélectionnée")
    .max(10, "Maximum 10 zones autorisées"),
  isVerified: z.boolean().optional()
});

// Driver update schema
export const updateDriverSchema = z.object({
  name: z.string()
    .min(2, "Nom doit contenir au moins 2 caractères")
    .max(50, "Nom ne peut pas dépasser 50 caractères")
    .optional(),
  licenseNumber: z.string()
    .min(5, "Numéro de permis invalide")
    .max(20, "Numéro de permis trop long")
    .optional(),
  vehicleType: z.enum(["SEDAN", "SUV", "MOTORCYCLE", "VAN"])
    .optional(),
  vehiclePlate: z.string()
    .min(3, "Plaque d'immatriculation invalide")
    .max(15, "Plaque d'immatriculation trop longue")
    .optional(),
  zones: z.array(z.string())
    .min(1, "Au moins une zone doit être sélectionnée")
    .max(10, "Maximum 10 zones autorisées")
    .optional()
});

// Driver verification schema
export const verifyDriverSchema = z.object({
  isVerified: z.boolean(),
  reason: z.string()
    .max(200, "Raison ne peut pas dépasser 200 caractères")
    .optional()
});

// Driver activation schema
export const activateDriverSchema = z.object({
  isActive: z.boolean(),
  reason: z.string()
    .max(200, "Raison ne peut pas dépasser 200 caractères")
    .optional()
});

// Booking cancellation schema
export const cancelBookingSchema = z.object({
  reason: z.string()
    .min(5, "Raison doit contenir au moins 5 caractères")
    .max(200, "Raison ne peut pas dépasser 200 caractères"),
  refundCustomer: z.boolean().optional(),
  notifyDriver: z.boolean().optional()
});

// Query schemas for list endpoints
export const driversQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["all", "verified", "unverified", "active", "inactive"]).default("all"),
  zone: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "rating"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const bookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  status: z.enum(["all", "PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED"]).default("all"),
  driverId: z.string().optional(),
  customerId: z.string().optional(),
  sortBy: z.enum(["createdAt", "pickupTime", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const statsQuerySchema = z.object({
  period: z.enum(["today", "week", "month"]).default("today")
});

// Types exports
export type LoginRequest = z.infer<typeof loginSchema>;
export type CreateDriverRequest = z.infer<typeof createDriverSchema>;
export type UpdateDriverRequest = z.infer<typeof updateDriverSchema>;
export type VerifyDriverRequest = z.infer<typeof verifyDriverSchema>;
export type ActivateDriverRequest = z.infer<typeof activateDriverSchema>;
export type CancelBookingRequest = z.infer<typeof cancelBookingSchema>;
export type DriversQuery = z.infer<typeof driversQuerySchema>;
export type BookingsQuery = z.infer<typeof bookingsQuerySchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
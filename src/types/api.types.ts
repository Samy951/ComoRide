import { Request } from 'express';
import { BookingStatus, PaymentStatus } from '@prisma/client';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    phoneNumber: string;
    type: "customer" | "driver";
    name: string;
  };
}

export interface AuthUser {
  id: string;
  phoneNumber: string;
  type: "customer" | "driver";
  name: string;
}

export interface VerifyResponse {
  id: string;
  phoneNumber: string;
  type: "customer" | "driver";
  name: string;
}

export interface AvailabilityResponse {
  isAvailable: boolean;
  isOnline: boolean;
  zones: string[];
  lastSeenAt: string;
}

export interface LocationResponse {
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export interface BookingResponse {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "COMPLETED";
  pickupAddress: string;
  dropAddress: string;
  pickupTime: string;
  passengers: number;
  estimatedFare?: number;
  createdAt: string;
}

export interface BookingDetailsResponse {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CANCELLED" | "COMPLETED";
  pickupAddress: string;
  dropAddress: string;
  pickupTime: string;
  passengers: number;
  customer: {
    name: string;
    phoneNumber: string;
  };
  driver?: {
    name: string;
    phoneNumber: string;
    vehicleType: string;
    vehiclePlate: string;
    rating: number;
  };
  estimatedFare?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AcceptBookingResponse {
  id: string;
  status: "ACCEPTED";
  driver: {
    name: string;
    phoneNumber: string;
    vehicleType: string;
    vehiclePlate: string;
  };
  estimatedFare?: number;
  updatedAt: string;
}

export interface CancelBookingResponse {
  id: string;
  status: "CANCELLED";
  cancellationReason: string;
  updatedAt: string;
}

// Admin types
export interface AdminRequest extends Request {
  admin: {
    id: string;
    role: 'admin';
  };
}

export interface AdminUser {
  id: string;
  role: 'admin';
  loginAt: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

// Driver admin types
export interface DriverWithStats {
  id: string;
  phoneNumber: string; // masqué: +269XX***XX
  name: string;
  licenseNumber: string;
  vehicleType: string;
  vehiclePlate: string;
  rating: number;
  isAvailable: boolean;
  isOnline: boolean;
  isVerified: boolean;
  isActive: boolean;
  zones: string[];
  lastSeenAt: string | null;
  createdAt: string;
  // Stats additionnelles
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  averageRating: number;
}

export interface DriverDetailed extends DriverWithStats {
  currentLat?: number;
  currentLng?: number;
  updatedAt: string;
}

export interface CreateDriverRequest {
  phoneNumber: string; // format +269XXXXXXXX
  name: string;
  licenseNumber: string;
  vehicleType: "SEDAN" | "SUV" | "MOTORCYCLE" | "VAN";
  vehiclePlate: string;
  zones: string[]; // ["Moroni", "Mutsamudu", ...]
  isVerified?: boolean; // default: false
}

export interface UpdateDriverRequest {
  name?: string;
  licenseNumber?: string;
  vehicleType?: string;
  vehiclePlate?: string;
  zones?: string[];
}

export interface VerifyDriverRequest {
  isVerified: boolean;
  reason?: string; // si false, raison du refus
}

export interface ActivateDriverRequest {
  isActive: boolean;
  reason?: string; // si false, raison de désactivation
}

// Booking admin types
export interface BookingWithDetails {
  id: string;
  pickupAddress: string;
  dropAddress: string;
  pickupTime: string;
  passengers: number;
  status: BookingStatus;
  estimatedFare: number | null;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phoneNumber: string; // masqué
    rating: number;
  };
  driver?: {
    id: string;
    name: string;
    phoneNumber: string; // masqué
    vehicleType: string;
    vehiclePlate: string;
    rating: number;
  };
  trip?: {
    id: string;
    fare: number;
    paymentStatus: PaymentStatus;
  };
}

export interface BookingDetailed extends BookingWithDetails {
  pickupLat?: number;
  pickupLng?: number;
  dropLat?: number;
  dropLng?: number;
  notes?: string;
  cancellationReason?: string;
  updatedAt: string;
}

export interface BookingTimelineEvent {
  timestamp: string;
  event: "CREATED" | "ACCEPTED" | "CANCELLED" | "COMPLETED";
  actor: "customer" | "driver" | "admin" | "system";
  details?: string;
}

export interface CancelBookingAdminRequest {
  reason: string;
  refundCustomer?: boolean;
  notifyDriver?: boolean;
}

// Pagination types
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// Stats types
export interface AdminStatsOverview {
  totalBookingsToday: number;
  completedTripsToday: number;
  activeDrivers: number; // isOnline = true
  onlineDrivers: number; // lastSeenAt < 5min
  pendingBookings: number;
  revenue: {
    today: number;
    week: number;
    month: number;
  };
}

export interface AdminStatsCharts {
  bookingsPerHour: Array<{ hour: number; count: number }>;
  topZones: Array<{ zone: string; bookings: number }>;
  driverPerformance: Array<{
    driverId: string;
    name: string;
    completedTrips: number;
    rating: number;
  }>;
}

export interface AdminStatsResponse {
  overview: AdminStatsOverview;
  charts: AdminStatsCharts;
}
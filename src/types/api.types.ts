import { Request } from 'express';

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
// Types copiés de la spec TICKET-005 - API Types

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Admin types
export interface AdminUser {
  id: string;
  role: 'admin';
  loginAt: string;
}

export interface LoginResponse {
  token: string;
  admin: AdminUser;
}

// Driver types
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

export interface CreateDriverRequest {
  phoneNumber: string; // format +269XXXXXXXX
  name: string;
  licenseNumber: string;
  vehicleType: "SEDAN" | "SUV" | "MOTORCYCLE" | "VAN";
  vehiclePlate: string;
  zones: string[]; // ["Moroni", "Mutsamudu", ...]
  isVerified?: boolean; // default: false
}

// Booking types
export interface BookingWithDetails {
  id: string;
  pickupAddress: string;
  dropAddress: string;
  pickupTime: string;
  passengers: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
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
    paymentStatus: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  };
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

// Form types
export interface LoginFormData {
  password: string;
}

export interface DriverFormData {
  phoneNumber: string;
  name: string;
  licenseNumber: string;
  vehicleType: "SEDAN" | "SUV" | "MOTORCYCLE" | "VAN";
  vehiclePlate: string;
  zones: string[];
  isVerified: boolean;
}
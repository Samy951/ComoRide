import api from './api';
import { 
  ApiResponse, 
  BookingWithDetails, 
  PaginatedResponse 
} from '../types/admin.types';

export interface BookingsQuery {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  status?: 'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  driverId?: string;
  customerId?: string;
  sortBy?: 'createdAt' | 'pickupTime' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export const bookingsService = {
  async getBookings(query: BookingsQuery = {}): Promise<PaginatedResponse<BookingWithDetails>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await api.get<ApiResponse<PaginatedResponse<BookingWithDetails>>>(
      `/admin/bookings?${params.toString()}`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la récupération des réservations');
  },

  async getBooking(id: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(`/admin/bookings/${id}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la récupération de la réservation');
  },

  async cancelBooking(id: string, reason: string): Promise<any> {
    const response = await api.put<ApiResponse<any>>(`/admin/bookings/${id}/cancel`, {
      reason,
      refundCustomer: true,
      notifyDriver: true
    });
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de l\'annulation de la réservation');
  }
};
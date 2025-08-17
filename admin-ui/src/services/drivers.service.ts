import api from './api';
import { 
  ApiResponse, 
  DriverWithStats, 
  PaginatedResponse, 
  CreateDriverRequest 
} from '../types/admin.types';

export interface DriversQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'all' | 'verified' | 'unverified' | 'active' | 'inactive';
  zone?: string;
  sortBy?: 'name' | 'createdAt' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export const driversService = {
  async getDrivers(query: DriversQuery = {}): Promise<PaginatedResponse<DriverWithStats>> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await api.get<ApiResponse<PaginatedResponse<DriverWithStats>>>(
      `/admin/drivers?${params.toString()}`
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la récupération des chauffeurs');
  },

  async getDriver(id: string): Promise<any> {
    const response = await api.get<ApiResponse<any>>(`/admin/drivers/${id}`);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la récupération du chauffeur');
  },

  async createDriver(data: CreateDriverRequest): Promise<{ driver: any }> {
    const response = await api.post<ApiResponse<{ driver: any }>>('/admin/drivers', data);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la création du chauffeur');
  },

  async updateDriver(id: string, data: Partial<CreateDriverRequest>): Promise<{ driver: any }> {
    const response = await api.put<ApiResponse<{ driver: any }>>(`/admin/drivers/${id}`, data);
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la modification du chauffeur');
  },

  async verifyDriver(id: string, isVerified: boolean, reason?: string): Promise<any> {
    const response = await api.put<ApiResponse<any>>(`/admin/drivers/${id}/verify`, {
      isVerified,
      reason
    });
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la vérification du chauffeur');
  },

  async activateDriver(id: string, isActive: boolean, reason?: string): Promise<any> {
    const response = await api.put<ApiResponse<any>>(`/admin/drivers/${id}/activate`, {
      isActive,
      reason
    });
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de l\'activation du chauffeur');
  }
};
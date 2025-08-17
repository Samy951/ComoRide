import api from './api';
import { ApiResponse, LoginResponse, AdminUser, LoginFormData } from '../types/admin.types';

export const authService = {
  async login(credentials: LoginFormData): Promise<LoginResponse> {
    const response = await api.post<ApiResponse<LoginResponse>>('/admin/login', credentials);
    
    if (response.data.success && response.data.data) {
      const { token, admin } = response.data.data;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(admin));
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur de connexion');
  },

  async logout(): Promise<void> {
    try {
      await api.post('/admin/logout');
    } catch (error) {
      // Ignore les erreurs de logout côté serveur
      console.warn('Logout error:', error);
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
  },

  async getCurrentUser(): Promise<AdminUser> {
    const response = await api.get<ApiResponse<AdminUser>>('/admin/me');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error?.message || 'Erreur lors de la récupération des informations');
  },

  isAuthenticated(): boolean {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    return !!(token && user);
  },

  getToken(): string | null {
    return localStorage.getItem('admin_token');
  },

  getUser(): AdminUser | null {
    const userStr = localStorage.getItem('admin_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }
};
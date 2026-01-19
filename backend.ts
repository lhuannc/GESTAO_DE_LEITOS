import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, ServiceOrder, OSStatus, Team, ComplementItem } from './types';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

class BackendDB {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Erro na requisição');
    }

    return response.json();
  }

  async authenticate(login: string, password: string): Promise<User | null> {
    try {
      return await this.request<User>('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
    } catch (error: any) {
      if (error.message.includes('401') || error.message.includes('incorretos')) {
        return null;
      }
      throw error;
    }
  }

  async getAllData() {
    return await this.request<{
      companies: Company[];
      units: Unit[];
      sectors: Sector[];
      beds: Bed[];
      services: ServiceType[];
      actions: ActionStatus[];
      users: User[];
      teams: Team[];
      complementItems: ComplementItem[];
      orders: ServiceOrder[];
    }>('/api/data');
  }

  async createOrdersFromService(requestData: {
    bedId: string;
    serviceId: string;
    userId: string;
    companyId: string;
    stepsItems?: Record<number, { itemId: string; quantity: number }[]>;
  }): Promise<ServiceOrder[]> {
    return await this.request<ServiceOrder[]>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  }

  async assignOrder(orderId: string, userId: string): Promise<ServiceOrder | null> {
    try {
      return await this.request<ServiceOrder>(`/api/orders/${orderId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async unassignOrder(orderId: string, adminUserId: string): Promise<ServiceOrder | null> {
    try {
      return await this.request<ServiceOrder>(`/api/orders/${orderId}/unassign`, {
        method: 'POST',
        body: JSON.stringify({ adminUserId }),
      });
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: OSStatus,
    userId: string,
    note?: string
  ): Promise<ServiceOrder | null> {
    try {
      return await this.request<ServiceOrder>(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, userId, note }),
      });
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  async saveRegistry(type: string, item: any) {
    return await this.request(`/api/registry`, {
      method: 'POST',
      body: JSON.stringify({ type, item }),
    });
  }

  async deleteRegistry(type: string, id: string): Promise<void> {
    await this.request(`/api/registry/${type}/${id}`, {
      method: 'DELETE',
    });
  }
}

export const db = new BackendDB();

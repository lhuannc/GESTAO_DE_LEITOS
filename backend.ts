import { Company, Unit, Sector, Bed, ServiceType, ActionStatus, User, ServiceOrder, OSStatus, Team, ComplementItem } from './types';

const API_BASE_URL = '/api';

class BackendDB {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  public getAllDataSync() {
    // Mantido para compatibilidade, mas agora será assíncrono
    throw new Error('getAllDataSync não é mais suportado. Use getAllData()');
  }

  async authenticate(login: string, password: string): Promise<User | null> {
    try {
      const user = await this.request<User>('/auth', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      });
      return user;
    } catch (error: any) {
      if (error.message.includes('401') || error.message.includes('Credenciais inválidas')) {
        return null;
      }
      throw error;
    }
  }

  async createOrdersFromService(requestData: { 
    bedId: string, 
    serviceId: string, 
    userId: string, 
    companyId: string,
    stepsItems?: Record<number, { itemId: string, quantity: number }[]> 
  }): Promise<ServiceOrder[]> {
    return this.request<ServiceOrder[]>('/orders/create', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  }

  async assignOrder(orderId: string, userId: string): Promise<ServiceOrder | null> {
    try {
      return await this.request<ServiceOrder>(`/orders/${orderId}/assign`, {
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
      return await this.request<ServiceOrder>(`/orders/${orderId}/unassign`, {
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

  async updateOrderStatus(orderId: string, status: OSStatus, userId: string, note?: string): Promise<ServiceOrder | null> {
    try {
      return await this.request<ServiceOrder>(`/orders/${orderId}/status`, {
        method: 'POST',
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
    return this.request(`/registry/${type}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async deleteRegistry(type: string, id: string) {
    return this.request(`/registry/${type}/${id}`, {
      method: 'DELETE',
    });
  }

  async getAllData() {
    const data = await this.request<{
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
    }>('/data');

    return {
      companies: data.companies || [],
      units: data.units || [],
      sectors: data.sectors || [],
      beds: data.beds || [],
      services: data.services || [],
      actions: data.actions || [],
      users: data.users || [],
      teams: data.teams || [],
      complementItems: data.complementItems || [],
      orders: data.orders || [],
    };
  }
}

export const db = new BackendDB();

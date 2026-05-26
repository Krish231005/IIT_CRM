import { DashboardSummary, ForecastPoint, Product, Customer, ETLLog, Anomaly, Supplier } from '../types.js';

const API_BASE = '/api';

// Simple token manager
export const auth = {
  getToken: () => localStorage.getItem('bi_platform_token'),
  getUser: () => {
    const userStr = localStorage.getItem('bi_platform_user');
    return userStr ? JSON.parse(userStr) : null;
  },
  login: async (email: string, password?: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Identity confirmation failed');
    }
    const data = await res.json();
    localStorage.setItem('bi_platform_token', data.token);
    localStorage.setItem('bi_platform_user', JSON.stringify(data.user));
    return data;
  },
  register: async (name: string, email: string, password?: string, role?: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },
  logout: () => {
    localStorage.removeItem('bi_platform_token');
    localStorage.removeItem('bi_platform_user');
  }
};

// Main operational metrics wrappers
export const biApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    return res.json();
  },
  getForecast: async (): Promise<ForecastPoint[]> => {
    const res = await fetch(`${API_BASE}/dashboard/forecast`);
    return res.json();
  },
  getCustomers: async (search = '', segment = '', page = 1): Promise<{ data: Customer[]; pagination: any }> => {
    const res = await fetch(`${API_BASE}/customers?search=${encodeURIComponent(search)}&segment=${encodeURIComponent(segment)}&page=${page}`);
    return res.json();
  },
  getProducts: async (search = '', category = '', page = 1, limit = 8): Promise<{ data: Product[]; pagination: any }> => {
    const res = await fetch(`${API_BASE}/products?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&page=${page}&limit=${limit}`);
    return res.json();
  },
  createProduct: async (prod: Omit<Product, 'id'>): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prod)
    });
    return res.json();
  },
  updateProduct: async (id: string, prod: Partial<Product>): Promise<Product> => {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prod)
    });
    return res.json();
  },
  deleteProduct: async (id: string): Promise<boolean> => {
    const res = await fetch(`${API_BASE}/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.success;
  },
  getAnomalies: async (): Promise<Anomaly[]> => {
    const res = await fetch(`${API_BASE}/anomalies`);
    return res.json();
  },
  resolveAnomaly: async (id: string, status: string): Promise<Anomaly> => {
    const res = await fetch(`${API_BASE}/anomalies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.json();
  },
  getRecommendations: async (customerId: string): Promise<Product[]> => {
    const res = await fetch(`${API_BASE}/recommendations/${customerId}`);
    return res.json();
  },
  getSTLogs: async (): Promise<ETLLog[]> => {
    const res = await fetch(`${API_BASE}/etl/logs`);
    return res.json();
  },
  uploadCSV: async (fileName: string, csvContent: string): Promise<ETLLog> => {
    const res = await fetch(`${API_BASE}/etl/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, csvContent })
    });
    return res.json();
  },
  triggerLiveTick: async (): Promise<{ transaction: any; anomaly?: Anomaly }> => {
    const res = await fetch(`${API_BASE}/realtime/tick`);
    return res.json();
  },
  queryAI: async (prompt: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/ai/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    return data.response;
  },
  getAIPresetReport: async (type: string): Promise<string> => {
    const res = await fetch(`${API_BASE}/ai/preset-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    return data.response;
  },
  getSuppliers: async (): Promise<Supplier[]> => {
    const res = await fetch(`${API_BASE}/suppliers`);
    return res.json();
  },
  wipeDatabase: async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/database/wipe`, { method: 'POST' });
    return res.json();
  },
  resetDemoDatabase: async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/database/reset`, { method: 'POST' });
    return res.json();
  },
  importDataset: async (entity: string, csvContent: string): Promise<{ success: boolean; rowsProcessed: number; errors?: string[] }> => {
    const res = await fetch(`${API_BASE}/database/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, csvContent })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to import ${entity} dataset.`);
    }
    return res.json();
  },
  getDatabaseStatus: async (): Promise<{
    products: number;
    customers: number;
    stores: number;
    transactions: number;
    suppliers: number;
    anomalies: number;
    etlLogs: number;
    mongoConnected?: boolean;
    mongoStatus?: string;
    mongoUriConfigured?: boolean;
  }> => {
    const res = await fetch(`${API_BASE}/database/status`);
    return res.json();
  },
  exportFullDatabase: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/database/backup`);
    return res.json();
  }
};

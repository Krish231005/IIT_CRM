export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  minRequiredStock: number;
  supplierId: string;
  region?: 'Northeast' | 'Midwest' | 'South' | 'West';
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  segment: string; // Champions, Loyal, At Risk, Churning, New
  recency: number; // Days since last purchase
  frequency: number; // Number of purchases
  monetary: number; // Total spending
  clv: number; // Customer Lifetime Value
  churnProbability: number; // 0 to 100%
  rfmScore: string; // e.g. "445"
  cluster: number; // KMeans cluster number
  region?: 'Northeast' | 'Midwest' | 'South' | 'West';
  preferredCategory?: string;
}

export interface Store {
  id: string;
  name: string;
  city: string;
  region: 'Northeast' | 'Midwest' | 'South' | 'West';
}

export interface Transaction {
  id: string;
  productId: string;
  customerId: string;
  storeId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  cost: number;
  margin: number;
  timestamp: string; // ISO format
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  category: string;
  reliabilityScore: number; // 1 to 100
}

export interface ETLLog {
  id: string;
  timestamp: string;
  fileName: string;
  rowsProcessed: number;
  rowsCleaned: number;
  status: 'Success' | 'Error';
  summary: string;
}

export interface Anomaly {
  id: string;
  transactionId?: string;
  productId?: string;
  type: 'Sales Spike' | 'Inventory Mismatch' | 'Suspicious Night Purchase' | 'Fraud Quantity';
  severity: 'Low' | 'Medium' | 'High';
  description: string;
  timestamp: string;
  status: 'Unresolved' | 'Investigating' | 'Resolved';
}

export interface ForecastPoint {
  date: string;
  actual?: number;
  forecast: number;
  lowerConfidence: number;
  upperConfidence: number;
  isFuture: boolean;
}

export interface User {
  id: string;
  email: string;
  role: 'Admin' | 'Analyst';
}

export interface DashboardSummary {
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  totalTransactions: number;
  totalCustomers: number;
  segmentDistribution: Record<string, number>;
  topProducts: Array<{ name: string; category: string; revenue: number; quantity: number }>;
  regionPerformance: Record<string, number>;
  categoryPerformance: Record<string, { revenue: number; profit: number }>;
  monthlyRevenueComparison: Array<{ month: string; currentYear: number; lastYear: number }>;
}

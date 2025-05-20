export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string; // e.g., kg, liter, pcs
  shelfLifeDays: number; // Standard shelf life in days
  createdAt: string; // ISO date string
  isArchived?: boolean; // For soft delete
}

export interface Batch {
  id: string;
  productId: string;
  productName?: string; // Denormalized for easier display
  productionDate: string; // ISO date string
  expiryDate: string; // ISO date string, calculated
  initialQuantity: number;
  currentQuantity: number;
  unitCost: number;
  createdAt: string; // ISO date string
}

export type TransactionType = 'IN' | 'OUT'; // Simplified for now
export type OutflowReason = 'SALE' | 'SPOILAGE' | 'INTERNAL_USE' | 'ADJUSTMENT_DECREASE' | 'ADJUSTMENT_INCREASE';

export interface Transaction {
  id: string;
  productId: string;
  productName?: string; // Denormalized
  batchId?: string;
  type: TransactionType;
  quantity: number; // Positive for IN, negative for OUT
  timestamp: string; // ISO date string
  reason?: OutflowReason;
  notes?: string;
  unitCostAtTransaction?: number; // To record cost at time of transaction
}

// For Stock Valuation Summary AI
export interface StockValuationSummaryParams {
  timeScale: string;
  outflowReason: string;
}

export const OUTFLOW_REASONS: OutflowReason[] = ['SALE', 'SPOILAGE', 'INTERNAL_USE', 'ADJUSTMENT_DECREASE'];
export const TIMESCALE_OPTIONS = [
  { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days' },
  { value: 'LAST_YEAR', label: 'Last Year' },
  { value: 'ALL_TIME', label: 'All Time' },
];

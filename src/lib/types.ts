
export type ProductCategory = 'INGREDIENT' | 'NON_INGREDIENT';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string; // e.g., kg, liter, pcs
  shelfLifeDays: number | null; // Standard shelf life in days, null if not applicable
  lowStockThreshold: number; // Product-specific low stock threshold
  imageUrl?: string; // Optional: Data URI for the product image
  createdAt: string; // ISO date string
  isArchived?: boolean; // For soft delete
}

export interface Batch {
  id: string;
  productId: string;
  productName?: string; // Denormalized for easier display
  productionDate: string | null; // ISO date string, null if not applicable
  expiryDate: string | null; // ISO date string, calculated, null if not applicable
  initialQuantity: number;
  currentQuantity: number;
  unitCost: number;
  createdAt: string; // ISO date string
}

export type TransactionType = 'IN' | 'OUT';

export type OutflowReasonValue = 'SALE' | 'SPOILAGE' | 'INTERNAL_USE' | 'ADJUSTMENT_DECREASE';

export interface OutflowReasonItem {
  value: OutflowReasonValue;
  label: string;
}

export const OUTFLOW_REASONS_WITH_LABELS: OutflowReasonItem[] = [
  { value: 'SALE', label: '销售' },
  { value: 'SPOILAGE', label: '损耗' },
  { value: 'INTERNAL_USE', label: '内部使用' },
  { value: 'ADJUSTMENT_DECREASE', label: '误操作修正' },
];


export interface Transaction {
  id: string;
  productId: string;
  productName?: string; // Denormalized
  batchId?: string;
  type: TransactionType;
  quantity: number; // Always positive, direction determined by type and isCorrectionIncrease
  timestamp: string; // ISO date string
  reason?: OutflowReasonValue;
  notes?: string;
  unitCostAtTransaction?: number; // To record cost at time of transaction
  isCorrectionIncrease?: boolean; // True if this 'OUT' transaction actually increased stock (negative outflow)
}

export interface AppSettings {
  expiryWarningDays: number;
}

export interface ProductStockAnalysis {
  productId: string;
  productName: string;
  productUnit: string;
  currentStock: number;
  avgDailyConsumptionLastWeek: number;
  predictedDepletionDate: string; // Formatted date or a string like 'N/A', '已耗尽', '无法预测'
  daysToDepletion?: number; // Numerical days, could be Infinity or NaN
}

export interface User {
  id: string;
  username: string;
  password?: string; // Storing plain text for prototype, normally this would be securely hashed
  isSuperAdmin?: boolean;
}


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

export type TransactionType = 'IN' | 'OUT';

export type OutflowReasonValue = 'SALE' | 'SPOILAGE' | 'INTERNAL_USE' | 'ADJUSTMENT_DECREASE' | 'ADJUSTMENT_INCREASE';

export interface OutflowReasonItem {
  value: OutflowReasonValue;
  label: string;
}

export const OUTFLOW_REASONS_WITH_LABELS: OutflowReasonItem[] = [
  { value: 'SALE', label: '销售' },
  { value: 'SPOILAGE', label: '损耗' },
  { value: 'INTERNAL_USE', label: '内部使用' },
  { value: 'ADJUSTMENT_DECREASE', label: '库存调整 (减少)' },
  // Note: ADJUSTMENT_INCREASE is not typically an "outflow" reason,
  // but kept for structural consistency if needed elsewhere.
  // For outflow forms, typically only decrease reasons are shown.
];


export interface Transaction {
  id: string;
  productId: string;
  productName?: string; // Denormalized
  batchId?: string;
  type: TransactionType;
  quantity: number; // Positive for IN, positive for OUT (type determines direction)
  timestamp: string; // ISO date string
  reason?: OutflowReasonValue;
  notes?: string;
  unitCostAtTransaction?: number; // To record cost at time of transaction
}

// For Stock Valuation Summary AI
export interface StockValuationSummaryParams {
  timeScale: string; // e.g., 'LAST_7_DAYS'
  outflowReason: string; // e.g., 'SALE', 'ALL'
}

export const TIMESCALE_OPTIONS = [
  { value: 'LAST_7_DAYS', label: '过去7天' },
  { value: 'LAST_30_DAYS', label: '过去30天' },
  { value: 'LAST_90_DAYS', label: '过去90天' },
  { value: 'LAST_YEAR', label: '过去一年' },
  { value: 'ALL_TIME', label: '全部时间' },
];

// For Stock Valuation Chart View
export const CHART_TIMESCALE_OPTIONS_TYPES = [
  { value: 'LAST_7_DAYS_DAILY', label: '每日 (过去7天)' },
  { value: 'LAST_30_DAYS_DAILY', label: '每日 (过去30天)' },
  { value: 'LAST_3_MONTHS_WEEKLY', label: '每周 (过去3个月)' },
  { value: 'LAST_12_MONTHS_MONTHLY', label: '每月 (过去12个月)' },
] as const; // Use "as const" for stricter type checking on values

export type ChartTimeScaleValue = typeof CHART_TIMESCALE_OPTIONS_TYPES[number]['value'];

export interface ChartDataPoint {
  date: string; // Formatted date string for X-axis
  [key: string]: number | string; // Allows for dynamic data keys like 'productValue'
}

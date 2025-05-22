
export type ProductCategory = 'INGREDIENT' | 'NON_INGREDIENT';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: string; 
  shelfLifeDays: number | null; 
  lowStockThreshold: number; 
  imageUrl?: string; 
  createdAt: string; 
  isArchived?: boolean; 
}

export interface Batch {
  id: string;
  productId: string;
  productName?: string; 
  productionDate: string | null; 
  expiryDate: string | null; 
  initialQuantity: number;
  currentQuantity: number;
  unitCost: number;
  createdAt: string; 
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
  productName?: string; 
  batchId?: string;
  type: TransactionType;
  quantity: number; 
  timestamp: string; 
  reason?: OutflowReasonValue;
  notes?: string;
  unitCostAtTransaction?: number; 
  isCorrectionIncrease?: boolean; 
}

export interface AppSettings {
  expiryWarningDays: number;
}

export type StockAnalysisTimeDimensionValue = 'YESTERDAY' | 'LAST_3_DAYS' | 'LAST_7_DAYS' | 'LAST_FULL_WEEK' | 'LAST_30_DAYS';

export interface StockAnalysisTimeDimensionOption {
  value: StockAnalysisTimeDimensionValue;
  label: string;
}

export interface ProductStockAnalysis {
  productId: string;
  productName: string;
  productUnit: string;
  currentStock: number;
  avgDailyConsumption: number;
  predictedDepletionDate: string; 
  daysToDepletion?: number; 
  analysisPeriodLabel: string; 
}

export interface User {
  id: string;
  username: string;
  password?: string; 
  isSuperAdmin?: boolean;
}

export interface ClientErrorLog {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  errorType?: string; 
  componentStack?: string; 
  url?: string; 
}

export type ProductColumnKey = 
  | 'name' 
  | 'category' 
  | 'unit' 
  | 'shelfLifeDays' 
  | 'lowStockThreshold' 
  | 'totalQuantity' 
  | 'totalValue' 
  | 'createdAt';

export interface ProductTableColumn {
  id: ProductColumnKey;
  label: string;
  defaultVisible: boolean;
  sortable: boolean;
  isNumeric?: boolean; 
  isDate?: boolean;    
  headerClassName?: string;
  cellClassName?: string;
  getValue: (product: Product, details: { totalQuantity: number; totalValue: number; batches: Batch[] }) => string | number | null;
}

// For Transaction Page Filters
export type TransactionTimeFilterValue = 
  | 'ALL'
  | 'TODAY' 
  | 'YESTERDAY' 
  | 'LAST_7_DAYS' // Up to and including yesterday
  | 'LAST_30_DAYS' // Up to and including yesterday
  | 'THIS_MONTH' 
  | 'LAST_MONTH';

export interface TransactionTimeFilterOption {
  value: TransactionTimeFilterValue;
  label: string;
}

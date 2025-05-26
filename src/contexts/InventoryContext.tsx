
"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, AppSettings, ProductStockAnalysis } from '@/lib/types';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast as globalToast } from "@/hooks/use-toast"; // Renamed to avoid conflict with local toast
import { formatISO, parseISO, isWithinInterval, addDays, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { useErrorLogger } from './ErrorContext'; // Import useErrorLogger

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
  depletionWarningDays: 5,
};

function getLastFullWeekDateRange(): { start: Date; end: Date; days: number } {
  const today = new Date();
  const todayStart = startOfWeek(today, { weekStartsOn: 1 });
  const startOfLastFullWeek = subWeeks(todayStart, 1);
  const endOfLastFullWeek = endOfDay(endOfWeek(startOfLastFullWeek, { weekStartsOn: 1 }));
  return { start: startOfLastFullWeek, end: endOfLastFullWeek, days: 7 };
}

interface InventoryContextType {
  products: Product[];
  batches: Batch[];
  transactions: Transaction[];
  appSettings: AppSettings;
  isLoadingProducts: boolean;
  isLoadingBatches: boolean;
  isLoadingTransactions: boolean;
  isLoadingSettings: boolean;
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => Promise<Product | undefined>;
  editProduct: (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => Promise<void>;
  archiveProduct: (productId: string) => Promise<void>;
  unarchiveProduct: (productId: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getMostRecentUnitCost: (productId: string) => number | undefined;
  addBatch: (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => Promise<Batch | undefined>;
  recordOutflowFromSpecificBatch: (productId: string, batchId: string, quantity: number, reason: OutflowReasonValue, notes?: string) => Promise<void>;
  getBatchesByProductId: (productId: string) => Batch[];
  getProductStockDetails: (productId: string) => { totalQuantity: number; totalValue: number; batches: Batch[] };
  updateAppSettings: (newSettings: Partial<AppSettings>, showSuccessToast?: boolean) => Promise<void>;
  getSingleProductAnalysisSummary: (productId: string) => Pick<ProductStockAnalysis, 'avgDailyConsumption' | 'predictedDepletionDate' | 'daysToDepletion'> | null;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const getApiAuthHeaders = () => {
  const apiKey = process.env.NEXT_PUBLIC_API_SECRET_KEY;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    console.warn("NEXT_PUBLIC_API_SECRET_KEY is not set for frontend. API calls might fail if backend requires authentication.");
  }
  return headers;
};

export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);

  const { addErrorLog } = useErrorLogger(); // Get the error logger

  // Generic API error handler
  const handleApiError = async (response: Response, operation: string, endpoint: string) => {
    let errorDetails = `Status: ${response.status} ${response.statusText}.`;
    try {
      const errorData = await response.json();
      errorDetails += ` Server Message: ${errorData.error || 'N/A'}. Details: ${errorData.details || 'N/A'}`;
    } catch (e) {
      // If parsing JSON fails, try to get text
      try {
        const errorText = await response.text();
        errorDetails += ` Server Response: ${errorText || 'Could not read error response body.'}`;
      } catch (textError) {
        errorDetails += ' Could not read error response body.';
      }
    }
    const fullErrorMessage = `${operation}失败 (API: ${endpoint}). ${errorDetails}`;
    globalToast({ title: "API错误", description: fullErrorMessage, variant: "destructive", duration: 7000 });
    addErrorLog(new Error(fullErrorMessage), undefined, 'API Call Error'); // Log to ErrorContext
    return new Error(fullErrorMessage); // Return an error object
  };


  const fetchAppSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/settings', { headers: getApiAuthHeaders() });
      if (!response.ok) {
        throw await handleApiError(response, "加载应用设置", "/api/settings");
      }
      const data: Partial<AppSettings> = await response.json();

      let currentExpiryDays = data.expiryWarningDays ?? DEFAULT_APP_SETTINGS.expiryWarningDays;
      let currentDepletionDays = data.depletionWarningDays ?? DEFAULT_APP_SETTINGS.depletionWarningDays;

      const settingsToSet: AppSettings = {
        expiryWarningDays: currentExpiryDays,
        depletionWarningDays: currentDepletionDays,
      };
      setAppSettings(settingsToSet);

    } catch (error) {
      // Error already handled by handleApiError if it's an API error, or logged if it's another type
      if (!(error instanceof Error && error.message.startsWith('加载应用设置失败'))) {
         addErrorLog(error instanceof Error ? error : new Error(String(error)), undefined, 'Fetch AppSettings Error');
      }
      console.error("Error fetching app settings, using defaults:", error);
      setAppSettings(DEFAULT_APP_SETTINGS);
    } finally {
      setIsLoadingSettings(false);
    }
  }, [addErrorLog]);

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch('/api/products', { headers: getApiAuthHeaders() });
      if (!response.ok) {
        throw await handleApiError(response, "加载产品数据", "/api/products");
      }
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [addErrorLog]);

  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const response = await fetch('/api/batches', { headers: getApiAuthHeaders() });
      if (!response.ok) {
         throw await handleApiError(response, "加载批次数据", "/api/batches");
      }
      const data: Batch[] = await response.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      setBatches([]);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [addErrorLog]);

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions', { headers: getApiAuthHeaders() });
      if (!response.ok) {
         throw await handleApiError(response, "加载交易记录", "/api/transactions");
      }
      const data: Transaction[] = await response.json();
      setTransactions(Array.isArray(data) ? data.map(t => ({...t, timestamp: formatISO(parseISO(t.timestamp))})) : []);
    } catch (error) {
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [addErrorLog]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>): Promise<Product | undefined> => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        throw await handleApiError(response, "添加产品", "POST /api/products");
      }
      const newProductFromServer: Product = await response.json();
      await fetchProducts();
      globalToast({ title: "成功", description: `产品 "${newProductFromServer.name}" 已添加。` });
      return newProductFromServer;
    } catch (error) {
      return undefined;
    }
  }, [fetchProducts, addErrorLog]);

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(updatedProductData),
      });
      if (!response.ok) {
        throw await handleApiError(response, "编辑产品", `PUT /api/products/${productId}`);
      }
      await fetchProducts();
      await fetchBatches(); // Batches might have productName denormalized
      await fetchTransactions(); // Transactions might have productName denormalized

      const updatedProductName = updatedProductData.name || products.find(p=>p.id === productId)?.name || '产品';
      globalToast({ title: "成功", description: `产品 "${updatedProductName}" 已更新。` });
    } catch (error) {
      // Error already handled
    }
  }, [fetchProducts, fetchBatches, fetchTransactions, products, addErrorLog]);

  const archiveProduct = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: getApiAuthHeaders(),
        body: JSON.stringify({ isArchived: true }),
      });
      if (!response.ok) {
         throw await handleApiError(response, "归档产品", `PATCH /api/products/${productId}`);
      }
      const updatedProductFromServer: Product = await response.json();
      await fetchProducts();
      globalToast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已归档。` });
    } catch (error) {
      // Error already handled
    }
  }, [fetchProducts, addErrorLog]);

  const unarchiveProduct = useCallback(async (productId: string) => {
     try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: getApiAuthHeaders(),
        body: JSON.stringify({ isArchived: false }),
      });
      if (!response.ok) {
        throw await handleApiError(response, "取消归档产品", `PATCH /api/products/${productId}`);
      }
      const updatedProductFromServer: Product = await response.json();
      await fetchProducts();
      globalToast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已取消归档。` });
    } catch (error) {
      // Error already handled
    }
  }, [fetchProducts, addErrorLog]);

  const addTransactionAPI = useCallback(async (transactionData: Omit<Transaction, 'id'>) => {
    const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(transactionData),
    });
    if (!response.ok) {
        throw await handleApiError(response, "添加交易记录", "POST /api/transactions");
    }
    return await response.json() as Transaction;
  }, [addErrorLog]);

  const updateBatchQuantityAPI = useCallback(async (batchId: string, newQuantity: number) => {
    const response = await fetch(`/api/batches/${batchId}`, {
      method: 'PUT',
      headers: getApiAuthHeaders(),
      body: JSON.stringify({ currentQuantity: newQuantity }),
    });
    if (!response.ok) {
      throw await handleApiError(response, `更新批次 ${batchId} 数量`, `PUT /api/batches/${batchId}`);
    }
    return await response.json() as Batch;
  }, [addErrorLog]);

  const addBatch = useCallback(async (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }): Promise<Batch | undefined> => {
    const product = products.find(p => p.id === batchData.productId); // Use local products state
    if (!product) {
      globalToast({ title: "错误", description: "未找到此批次的产品。", variant: "destructive" });
      addErrorLog(new Error(`Add batch failed: Product not found locally for ID ${batchData.productId}`), undefined, 'Client Validation Error');
      return undefined;
    }
     if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      globalToast({ title: "错误", description: "必须为入库批次提供有效的单位成本。", variant: "destructive"});
      addErrorLog(new Error('Add batch failed: Invalid unit cost.'), undefined, 'Client Validation Error');
      return undefined;
    }
     if (batchData.initialQuantity <=0) {
       globalToast({ title: "错误", description: "接收数量必须大于0。", variant: "destructive"});
       addErrorLog(new Error('Add batch failed: Initial quantity must be > 0.'), undefined, 'Client Validation Error');
       return undefined;
    }

    try {
      const batchResponse = await fetch('/api/batches', {
        method: 'POST',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(batchData),
      });

      if (!batchResponse.ok) {
        throw await handleApiError(batchResponse, "添加入库批次", "POST /api/batches");
      }
      const newBatchFromServer: Batch = await batchResponse.json();

      const transactionForNewBatch: Omit<Transaction, 'id'> = {
        productId: newBatchFromServer.productId,
        productName: newBatchFromServer.productName || product.name,
        batchId: newBatchFromServer.id,
        type: 'IN',
        quantity: newBatchFromServer.initialQuantity,
        timestamp: newBatchFromServer.createdAt,
        unitCostAtTransaction: newBatchFromServer.unitCost,
        notes: `批次 ${newBatchFromServer.id} 的初始入库`,
        isCorrectionIncrease: false,
      };
      await addTransactionAPI(transactionForNewBatch);
      await Promise.all([fetchBatches(), fetchTransactions()]);

      globalToast({ title: "成功", description: `"${newBatchFromServer.productName || product.name}" 的批次已添加。数量: ${newBatchFromServer.initialQuantity}，单位成本: ¥${newBatchFromServer.unitCost.toFixed(2)}` });
      return newBatchFromServer;
    } catch (error) {
      return undefined;
    }
  }, [products, addTransactionAPI, fetchBatches, fetchTransactions, addErrorLog]);

  const recordOutflowFromSpecificBatch = useCallback(async (productId: string, batchId: string, quantityToOutflow: number, reason: OutflowReasonValue, notes?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      globalToast({ title: "错误", description: "未找到产品。", variant: "destructive" });
      addErrorLog(new Error(`Record outflow failed: Product not found locally for ID ${productId}`), undefined, 'Client Validation Error');
      return;
    }
    if (quantityToOutflow === 0) {
      globalToast({ title: "错误", description: "出库数量不能为零。", variant: "destructive" });
      addErrorLog(new Error('Record outflow failed: Quantity cannot be zero.'), undefined, 'Client Validation Error');
      return;
    }

    const batch = batches.find(b => b.id === batchId && b.productId === productId);
    if (!batch) {
       globalToast({ title: "错误", description: "未找到指定的批次进行出库。", variant: "destructive" });
       addErrorLog(new Error(`Record outflow failed: Batch not found for ID ${batchId} and Product ID ${productId}`), undefined, 'Client Validation Error');
       return;
    }

    let newCalculatedCurrentQuantity = batch.currentQuantity;
    if (quantityToOutflow > 0) {
      if (batch.currentQuantity < quantityToOutflow) {
        globalToast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
        addErrorLog(new Error(`Record outflow failed: Insufficient stock in batch ${batchId}. Available: ${batch.currentQuantity}, Tried: ${quantityToOutflow}`), undefined, 'Client Validation Error');
        return;
      }
      newCalculatedCurrentQuantity = batch.currentQuantity - quantityToOutflow;
    } else {
      newCalculatedCurrentQuantity = batch.currentQuantity + Math.abs(quantityToOutflow);
    }

    const transactionForOutflow: Omit<Transaction, 'id'> = {
      productId: product.id,
      productName: product.name,
      batchId: batchId,
      type: 'OUT',
      quantity: Math.abs(quantityToOutflow),
      timestamp: formatISO(new Date()),
      reason,
      notes,
      unitCostAtTransaction: batch.unitCost,
      isCorrectionIncrease: quantityToOutflow < 0 ? true : false,
    };

    try {
      await addTransactionAPI(transactionForOutflow);
      await updateBatchQuantityAPI(batchId, newCalculatedCurrentQuantity);
      await Promise.all([fetchBatches(), fetchTransactions()]);

      const successMsg = quantityToOutflow < 0 ?
        `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：${reason}。` :
        `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。原因：${reason}。`;
      globalToast({ title: "操作成功", description: successMsg });

    } catch (error) {
      // Error should be handled by addTransactionAPI or updateBatchQuantityAPI
      // Fetch latest state to try and recover/reflect actual DB state
      await Promise.all([fetchBatches(), fetchTransactions()]);
    }
  }, [products, batches, addTransactionAPI, updateBatchQuantityAPI, fetchBatches, fetchTransactions, addErrorLog]);

  const updateAppSettings = useCallback(async (newSettings: Partial<AppSettings>, showSuccessToast = true) => {
    const settingsToUpdate: AppSettings = {
        expiryWarningDays: newSettings.expiryWarningDays ?? appSettings.expiryWarningDays,
        depletionWarningDays: newSettings.depletionWarningDays ?? appSettings.depletionWarningDays,
    };
    if (typeof settingsToUpdate.expiryWarningDays !== 'number' || settingsToUpdate.expiryWarningDays < 0) {
        globalToast({ title: "错误", description: "有效的临近过期预警天数 (非负数) 为必填项。", variant: "destructive" });
        addErrorLog(new Error('Update settings failed: Invalid expiryWarningDays.'), undefined, 'Client Validation Error');
        return;
    }
    if (typeof settingsToUpdate.depletionWarningDays !== 'number' || settingsToUpdate.depletionWarningDays < 0) {
        globalToast({ title: "错误", description: "有效的预计耗尽预警天数 (非负数) 为必填项。", variant: "destructive" });
        addErrorLog(new Error('Update settings failed: Invalid depletionWarningDays.'), undefined, 'Client Validation Error');
        return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(settingsToUpdate),
      });
      if (!response.ok) {
        throw await handleApiError(response, "更新应用设置", "PUT /api/settings");
      }
      const updatedSettingsFromServer: AppSettings = await response.json();
      setAppSettings({
        expiryWarningDays: updatedSettingsFromServer.expiryWarningDays ?? settingsToUpdate.expiryWarningDays,
        depletionWarningDays: updatedSettingsFromServer.depletionWarningDays ?? settingsToUpdate.depletionWarningDays,
      });
      if (showSuccessToast) {
        globalToast({ title: "成功", description: "设置已保存。" });
      }
    } catch (error) {
      // Error handled by handleApiError
    }
  }, [appSettings, addErrorLog]);


  useEffect(() => {
    const fetchData = async () => {
      await fetchAppSettings(); // Fetch settings first
      await Promise.all([
          fetchProducts(),
          fetchBatches(),
          fetchTransactions()
      ]);
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed dependencies as they are stable or managed internally by useCallback

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const getBatchesByProductId = useCallback((productId: string) => {
    return batches.filter(b => b.productId === productId);
  }, [batches]);

  const getProductStockDetails = useCallback((productId: string) => {
    const productBatches = batches.filter(b => b.productId === productId && b.currentQuantity > 0);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return { totalQuantity, totalValue, batches: productBatches };
  }, [batches]);

  const getSingleProductAnalysisSummary = useCallback((productId: string): Pick<ProductStockAnalysis, 'avgDailyConsumption' | 'predictedDepletionDate' | 'daysToDepletion'> | null => {
    if (isLoadingProducts || isLoadingBatches || isLoadingTransactions || isLoadingSettings) return null;

    const product = products.find(p => p.id === productId);
    if (!product) return null;

    const { totalQuantity: currentStock } = getProductStockDetails(productId);
    const { start, end, days } = getLastFullWeekDateRange();

    const transactionsInPeriod = transactions.filter(t =>
      t.productId === productId &&
      t.type === 'OUT' &&
      !t.isCorrectionIncrease &&
      isWithinInterval(parseISO(t.timestamp), { start, end })
    );

    const totalConsumedInPeriod = transactionsInPeriod.reduce((sum, t) => sum + t.quantity, 0);
    const avgDailyConsumption = days > 0 ? totalConsumedInPeriod / days : 0;

    let predictedDepletionDate: string;
    let daysToDepletionNum: number | undefined = undefined;

    if (currentStock <= 0) {
      predictedDepletionDate = "已耗尽";
      daysToDepletionNum = 0;
    } else if (avgDailyConsumption <= 0) {
      predictedDepletionDate = "无消耗";
      daysToDepletionNum = Infinity;
    } else {
      const daysLeft = currentStock / avgDailyConsumption;
      daysToDepletionNum = Math.round(daysLeft);
      const depletionDate = addDays(new Date(), daysLeft);
      predictedDepletionDate = formatISO(depletionDate, { representation: 'date' });
    }

    return {
      avgDailyConsumption: parseFloat(avgDailyConsumption.toFixed(2)),
      predictedDepletionDate,
      daysToDepletion: daysToDepletionNum,
    };
  }, [products, transactions, getProductStockDetails, isLoadingProducts, isLoadingBatches, isLoadingTransactions, isLoadingSettings]);


  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      appSettings,
      isLoadingProducts,
      isLoadingBatches,
      isLoadingTransactions,
      isLoadingSettings,
      addProduct,
      editProduct,
      archiveProduct,
      unarchiveProduct,
      getProductById,
      getMostRecentUnitCost,
      addBatch,
      recordOutflowFromSpecificBatch,
      getBatchesByProductId,
      getProductStockDetails,
      updateAppSettings,
      getSingleProductAnalysisSummary,
    }}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory 必须在 InventoryProvider 中使用');
  }
  return context;
};

    
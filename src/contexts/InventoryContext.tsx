
"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, AppSettings, ProductStockAnalysis } from '@/lib/types';
// import { nanoid } from 'nanoid'; // No longer used directly in context for IDs
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";
import { formatISO, parseISO, differenceInDays, startOfWeek, endOfWeek, subWeeks, isWithinInterval, addDays, endOfDay, subDays, eachDayOfInterval } from 'date-fns';

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
  depletionWarningDays: 5, 
};

// Helper to get the date range for 'LAST_FULL_WEEK'
function getLastFullWeekDateRange(): { start: Date; end: Date; days: number } {
  const today = new Date();
  const todayStart = startOfWeek(today, { weekStartsOn: 1 }); // start of THIS week (Monday)
  const startOfLastFullWeek = subWeeks(todayStart, 1);       // Monday of LAST week
  const endOfLastFullWeek = endOfDay(endOfWeek(startOfLastFullWeek, { weekStartsOn: 1 })); // Sunday of LAST week, end of day
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
  updateAppSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
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

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch('/api/products', { headers: getApiAuthHeaders() });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error from /api/products' }));
        throw new Error(errorData.error || `Failed to fetch products (status: ${response.status})`);
      }
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({ title: "错误", description: `加载产品数据失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const response = await fetch('/api/batches', { headers: getApiAuthHeaders() });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error from /api/batches' }));
        throw new Error(errorData.error || `Failed to fetch batches (status: ${response.status})`);
      }
      const data: Batch[] = await response.json();
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast({ title: "错误", description: `加载批次数据失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      setBatches([]);
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions', { headers: getApiAuthHeaders() });
      if (!response.ok) {
         const errorData = await response.json().catch(() => ({ error: 'Failed to parse error from /api/transactions' }));
        throw new Error(errorData.error || `Failed to fetch transactions (status: ${response.status})`);
      }
      const data: Transaction[] = await response.json();
      setTransactions(Array.isArray(data) ? data.map(t => ({...t, timestamp: formatISO(parseISO(t.timestamp))})) : []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({ title: "错误", description: `加载交易记录失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

 const updateAppSettings = useCallback(async (newSettings: Partial<AppSettings>, showSuccessToast = true) => {
    const settingsToUpdate: AppSettings = {
        expiryWarningDays: newSettings.expiryWarningDays ?? appSettings.expiryWarningDays,
        depletionWarningDays: newSettings.depletionWarningDays ?? appSettings.depletionWarningDays,
    };

    if (typeof settingsToUpdate.expiryWarningDays !== 'number' || settingsToUpdate.expiryWarningDays < 0) {
        toast({ title: "错误", description: "有效的临近过期预警天数 (非负数) 为必填项。", variant: "destructive" });
        return;
    }
    if (typeof settingsToUpdate.depletionWarningDays !== 'number' || settingsToUpdate.depletionWarningDays < 0) {
        toast({ title: "错误", description: "有效的预计耗尽预警天数 (非负数) 为必填项。", variant: "destructive" });
        return;
    }

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(settingsToUpdate),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error from PUT /api/settings' }));
        throw new Error(errorData.error || 'Failed to update settings via API');
      }
      const updatedSettingsFromServer: AppSettings = await response.json();
      setAppSettings({
        expiryWarningDays: updatedSettingsFromServer.expiryWarningDays ?? settingsToUpdate.expiryWarningDays,
        depletionWarningDays: updatedSettingsFromServer.depletionWarningDays ?? settingsToUpdate.depletionWarningDays,
      });
      if (showSuccessToast) {
        toast({ title: "成功", description: "设置已保存。" });
      }
    } catch (error) {
      console.error("Error updating app settings:", error);
      toast({ title: "错误", description: `更新设置失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [appSettings]);


  const fetchAppSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/settings', { headers: getApiAuthHeaders() });
      if (!response.ok) {
        const errorBody = await response.text(); 
        let errorMessage = `Failed to fetch app settings from API (status: ${response.status})`;
        try {
            const errorData = JSON.parse(errorBody);
            errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (e) {
            // If parsing fails, use the raw text or a generic message
            errorMessage = errorBody || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data: Partial<AppSettings> = await response.json(); 
      
      const fetchedExpiryWarningDays = data.expiryWarningDays;
      const fetchedDepletionWarningDays = data.depletionWarningDays;

      let settingsWereIncompleteOrInvalid = false;
      const completeSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };

      if (typeof fetchedExpiryWarningDays === 'number' && fetchedExpiryWarningDays >= 0) {
        completeSettings.expiryWarningDays = fetchedExpiryWarningDays;
      } else {
        settingsWereIncompleteOrInvalid = true;
        console.warn("Fetched expiryWarningDays was invalid or missing from API, using default:", DEFAULT_APP_SETTINGS.expiryWarningDays);
      }

      if (typeof fetchedDepletionWarningDays === 'number' && fetchedDepletionWarningDays >= 0) {
        completeSettings.depletionWarningDays = fetchedDepletionWarningDays;
      } else {
        settingsWereIncompleteOrInvalid = true;
        console.warn("Fetched depletionWarningDays was invalid or missing from API, using default:", DEFAULT_APP_SETTINGS.depletionWarningDays);
      }
      
      setAppSettings(completeSettings);

      if (settingsWereIncompleteOrInvalid && process.env.POSTGRES_URL) { 
        console.log("Attempting to save complete default settings back to DB due to incomplete/invalid fetch from API.");
        // Update using the completed settings that include defaults for missing fields
        await updateAppSettings(completeSettings, false); 
      }

    } catch (error) {
      console.error("Error fetching app settings:", error);
      toast({ title: "错误", description: `加载应用设置失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      setAppSettings(DEFAULT_APP_SETTINGS); // Fallback to application defaults on error
    } finally {
      setIsLoadingSettings(false);
    }
  }, [updateAppSettings]); 
  
  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>): Promise<Product | undefined> => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error from POST /api/products' }));
        throw new Error(errorData.error || 'Failed to add product via API');
      }
      const newProductFromServer: Product = await response.json();
      await fetchProducts(); // Refetch to update list
      toast({ title: "成功", description: `产品 "${newProductFromServer.name}" 已添加。` });
      return newProductFromServer;
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ title: "错误", description: `添加产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      return undefined;
    }
  }, [fetchProducts]);

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category' | 'lowStockThreshold'>>) => {
    try {
      const productToSubmit = { ...updatedProductData };
      // Ensure lowStockThreshold is part of the payload if it was part of the Product type for editing
      // Since it's now on AppSettings for depletion, product-specific lowStockThreshold might not be sent
      // The API /api/products/[productId] might need adjustment if it expects lowStockThreshold
      const productFromState = products.find(p => p.id === productId);
      if (productFromState && productFromState.lowStockThreshold !== undefined && updatedProductData.lowStockThreshold === undefined) {
        // If backend expects it and form doesn't provide it, send original
        // (productFromState as any).lowStockThreshold = productFromState.lowStockThreshold; // This line is tricky, depends on API
      }


      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(productToSubmit),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to parse error from PUT /api/products/${productId}` }));
        throw new Error(errorData.error || `Failed to update product ${productId} via API`);
      }
      await fetchProducts(); 
      
      // If product name changed, batches and transactions with this product name might need to be updated
      // if they store product_name and are not fetched by joining. Our API for batches/transactions handles this.
      await fetchBatches();
      await fetchTransactions();

      const updatedProductName = updatedProductData.name || products.find(p=>p.id === productId)?.name || '产品';
      toast({ title: "成功", description: `产品 "${updatedProductName}" 已更新。` });
    } catch (error) {
      console.error(`Error editing product ${productId}:`, error);
      toast({ title: "错误", description: `编辑产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [fetchProducts, fetchBatches, fetchTransactions, products]);

  const archiveProduct = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: getApiAuthHeaders(),
        body: JSON.stringify({ isArchived: true }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to parse error from PATCH /api/products/${productId}` }));
        throw new Error(errorData.error || `Failed to archive product ${productId} via API`);
      }
      const updatedProductFromServer: Product = await response.json();
      await fetchProducts(); 
      toast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已归档。` });
    } catch (error) {
      console.error(`Error archiving product ${productId}:`, error);
      toast({ title: "错误", description: `归档产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [fetchProducts]);

  const unarchiveProduct = useCallback(async (productId: string) => {
     try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: getApiAuthHeaders(),
        body: JSON.stringify({ isArchived: false }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to parse error from PATCH /api/products/${productId}` }));
        throw new Error(errorData.error || `Failed to unarchive product ${productId} via API`);
      }
      const updatedProductFromServer: Product = await response.json();
      await fetchProducts(); 
      toast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已取消归档。` });
    } catch (error) {
      console.error(`Error unarchiving product ${productId}:`, error);
      toast({ title: "错误", description: `取消归档产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [fetchProducts]);


  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const addTransactionAPI = useCallback(async (transactionData: Omit<Transaction, 'id'>) => {
    const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(transactionData),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from transaction API' }));
        throw new Error(errorData.error || `Failed to add transaction via API for product ${transactionData.productId}`);
    }
    return await response.json() as Transaction;
  }, []);


  const addBatch = useCallback(async (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }): Promise<Batch | undefined> => {
    const product = getProductById(batchData.productId);
    if (!product) {
      toast({ title: "错误", description: "未找到此批次的产品。", variant: "destructive" });
      return undefined;
    }
    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      toast({ title: "错误", description: "必须为入库批次提供有效的单位成本。", variant: "destructive"});
      return undefined;
    }
     if (batchData.initialQuantity <=0) {
       toast({ title: "错误", description: "接收数量必须大于0。", variant: "destructive"});
       return undefined;
    }

    try {
      const batchResponse = await fetch('/api/batches', {
        method: 'POST',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(batchData),
      });

      if (!batchResponse.ok) {
        const errorData = await batchResponse.json().catch(() => ({ error: 'Failed to parse error from batch API' }));
        throw new Error(errorData.error || 'Failed to add batch via API');
      }
      const newBatchFromServer: Batch = await batchResponse.json();
      // await fetchBatches(); // API now returns the created batch, add it locally or refetch

      const transactionForNewBatch: Omit<Transaction, 'id'> = {
        productId: newBatchFromServer.productId,
        productName: newBatchFromServer.productName || product.name, // Use name from batch if API returns it
        batchId: newBatchFromServer.id,
        type: 'IN',
        quantity: newBatchFromServer.initialQuantity,
        timestamp: newBatchFromServer.createdAt, // Use createdAt from the new batch
        unitCostAtTransaction: newBatchFromServer.unitCost,
        notes: `批次 ${newBatchFromServer.id} 的初始入库`,
        isCorrectionIncrease: false,
      };

      await addTransactionAPI(transactionForNewBatch);
      
      // After both batch and transaction are successfully added to DB, refetch all to ensure UI consistency
      await Promise.all([fetchBatches(), fetchTransactions()]);


      toast({ title: "成功", description: `"${newBatchFromServer.productName || product.name}" 的批次已添加。数量: ${newBatchFromServer.initialQuantity}，单位成本: ¥${newBatchFromServer.unitCost.toFixed(2)}` });
      return newBatchFromServer;
    } catch (error) {
      console.error("Error adding batch or its transaction:", error);
      toast({ title: "错误", description: `添加入库批次操作失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      return undefined;
    }
  }, [getProductById, fetchBatches, addTransactionAPI, fetchTransactions]);


  const recordOutflowFromSpecificBatch = useCallback(async (productId: string, batchId: string, quantityToOutflow: number, reason: OutflowReasonValue, notes?: string) => {
    const product = getProductById(productId);
    if (!product) {
      toast({ title: "错误", description: "未找到产品。", variant: "destructive" });
      return;
    }
    if (quantityToOutflow === 0) {
      toast({ title: "错误", description: "出库数量不能为零。", variant: "destructive" });
      return;
    }

    const batch = batches.find(b => b.id === batchId && b.productId === productId);
    if (!batch) {
       toast({ title: "错误", description: "未找到指定的批次进行出库。", variant: "destructive" });
       return;
    }

    let newCalculatedCurrentQuantity = batch.currentQuantity;
    if (quantityToOutflow > 0) {
      if (batch.currentQuantity < quantityToOutflow) {
        toast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
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
      
      const batchUpdateResponse = await fetch(`/api/batches/${batchId}`, {
          method: 'PUT',
          headers: getApiAuthHeaders(),
          body: JSON.stringify({ currentQuantity: newCalculatedCurrentQuantity }),
      });

      if (!batchUpdateResponse.ok) {
          const errorData = await batchUpdateResponse.json().catch(() => ({ error: 'Failed to parse error from batch update API' }));
          // Even if DB update fails for batch, transaction was recorded. Refetch for UI consistency.
          await Promise.all([fetchBatches(), fetchTransactions()]);
          toast({ title: "警告: 数据同步可能不一致", description: `交易已记录，但批次 ${batchId} 库存数据库更新失败: ${errorData.error || '未知错误'}。请手动核实。`, variant: "destructive", duration: 10000 });
          console.error("Transaction recorded, but batch update failed in DB:", errorData.error);
          return; 
      }
      
      await Promise.all([fetchBatches(), fetchTransactions()]);

      const successMsg = quantityToOutflow < 0 ?
        `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：${reason}。` :
        `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。原因：${reason}。`;
      toast({ title: "操作成功", description: successMsg });

    } catch (error) {
      console.error("Error recording outflow or updating batch:", error);
      await Promise.all([fetchBatches(), fetchTransactions()]); // Refetch in case of any error
      toast({ title: "错误", description: `记录出库操作失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [getProductById, batches, addTransactionAPI, fetchBatches, fetchTransactions]);

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
  }, [products, transactions, getProductStockDetails, isLoadingProducts, isLoadingBatches, isLoadingTransactions, isLoadingSettings, appSettings]); // Added appSettings to dependency array


  const addSampleDataIfNeeded = useCallback(async () => {
    // This function is intentionally left empty as per user request to not add default sample data.
    // If sample data is needed for testing, this function can be re-implemented.
  }, []);


  useEffect(() => {
    Promise.all([
        fetchProducts(),
        fetchBatches(),
        fetchTransactions(),
        fetchAppSettings()
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
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


"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, AppSettings, ProductStockAnalysis } from '@/lib/types';
// import { nanoid } from 'nanoid'; // No longer used directly in context for IDs
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";
import { formatISO, parseISO, differenceInDays, startOfWeek, endOfWeek, subWeeks, isWithinInterval, addDays, endOfDay, subDays, eachDayOfInterval } from 'date-fns';

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
  depletionWarningDays: 5, // Default value for depletion warning
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
  if (!apiKey) {
    console.warn("NEXT_PUBLIC_API_SECRET_KEY is not set. API calls might fail if backend requires authentication, or will be bypassed in DB-less dev mode if API_SECRET_KEY is also not set on backend.");
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
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
        if (response.status === 401) throw new Error('API: Unauthorized to fetch products.');
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || `Failed to fetch products from API (status: ${response.status})`);
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
        if (response.status === 401) throw new Error('API: Unauthorized to fetch batches.');
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || `Failed to fetch batches from API (status: ${response.status})`);
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
         if (response.status === 401) throw new Error('API: Unauthorized to fetch transactions.');
         const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || `Failed to fetch transactions from API (status: ${response.status})`);
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

    // Basic client-side validation for required fields
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
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || 'Failed to update settings via API');
      }
      const updatedSettingsFromServer: AppSettings = await response.json();
      // Ensure both fields are present, falling back to current state or defaults if API returns partial/null for a field
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
        if (response.status === 401) throw new Error('API: Unauthorized to fetch settings.');
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || `Failed to fetch app settings from API (status: ${response.status})`);
      }
      const data: Partial<AppSettings> = await response.json(); 
      
      const fetchedExpiryWarningDays = data.expiryWarningDays;
      const fetchedDepletionWarningDays = data.depletionWarningDays;

      let settingsWereIncomplete = false;
      const completeSettings: AppSettings = { ...DEFAULT_APP_SETTINGS };

      if (typeof fetchedExpiryWarningDays === 'number' && fetchedExpiryWarningDays >= 0) {
        completeSettings.expiryWarningDays = fetchedExpiryWarningDays;
      } else {
        settingsWereIncomplete = true;
        console.warn("Fetched expiryWarningDays was invalid or missing, using default.");
      }

      if (typeof fetchedDepletionWarningDays === 'number' && fetchedDepletionWarningDays >= 0) {
        completeSettings.depletionWarningDays = fetchedDepletionWarningDays;
      } else {
        settingsWereIncomplete = true;
        console.warn("Fetched depletionWarningDays was invalid or missing, using default.");
      }
      
      setAppSettings(completeSettings);

      if (settingsWereIncomplete && process.env.POSTGRES_URL) { 
        console.log("Attempting to save complete default settings back to DB due to incomplete fetch.");
        // Ensure updateAppSettings is called with the fully formed completeSettings object
        await updateAppSettings(completeSettings, false); 
      }

    } catch (error) {
      console.error("Error fetching app settings:", error);
      toast({ title: "错误", description: `加载应用设置失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      setAppSettings(DEFAULT_APP_SETTINGS);
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
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || 'Failed to add product via API');
      }
      const newProductFromServer: Product = await response.json();
      await fetchProducts();
      toast({ title: "成功", description: `产品 "${newProductFromServer.name}" 已添加。` });
      return newProductFromServer;
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ title: "错误", description: `添加产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      return undefined;
    }
  }, [fetchProducts]);

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(updatedProductData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || `Failed to update product ${productId} via API`);
      }
      await fetchProducts(); 
      const updatedProductName = updatedProductData.name || products.find(p=>p.id === productId)?.name || '产品';
      
      // If product name changed, batches and transactions with this product name need to be updated or handled
      // For simplicity, we'll refetch batches and transactions which might have product name updated on server side
      // if they store product_name.
      await fetchBatches();
      await fetchTransactions();

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
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
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
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
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
        const errorData = await batchResponse.json().catch(() => ({ error: 'Failed to parse error response from batch API' }));
        throw new Error(errorData.error || 'Failed to add batch via API');
      }
      const newBatchFromServer: Batch = await batchResponse.json();
      await fetchBatches();

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
      await fetchTransactions(); 

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
      // Step 1: Record the transaction
      await addTransactionAPI(transactionForOutflow);
      
      // Step 2: Update the batch quantity in the database
      const batchUpdateResponse = await fetch(`/api/batches/${batchId}`, {
          method: 'PUT',
          headers: getApiAuthHeaders(),
          body: JSON.stringify({ currentQuantity: newCalculatedCurrentQuantity }),
      });

      if (!batchUpdateResponse.ok) {
          const errorData = await batchUpdateResponse.json().catch(() => ({ error: 'Failed to parse error response from batch update API' }));
          console.error("Transaction recorded, but batch update failed in DB:", errorData.error);
          // Even if DB update fails, re-fetch to ensure UI consistency (though it might be stale)
          await fetchBatches(); 
          await fetchTransactions();
          toast({ title: "警告: 数据同步可能不一致", description: `交易已记录，但批次 ${batchId} 库存数据库更新失败: ${errorData.error || '未知错误'}。请手动核实。`, variant: "destructive", duration: 10000 });
          return; 
      }

      // Step 3: If both transaction and batch update were successful, refetch data for UI consistency
      await fetchBatches();
      await fetchTransactions();

      const successMsg = quantityToOutflow < 0 ?
        `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：${reason}。` :
        `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。原因：${reason}。`;
      toast({ title: "操作成功", description: successMsg });

    } catch (error) {
      console.error("Error recording outflow or updating batch:", error);
      // Refetch in case of any error to try and get the most current state
      await fetchBatches(); 
      await fetchTransactions();
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
  }, [products, transactions, getProductStockDetails, isLoadingProducts, isLoadingBatches, isLoadingTransactions, isLoadingSettings, appSettings]);


  const addSampleDataIfNeeded = useCallback(async () => {
    if (process.env.NODE_ENV === 'development' && !process.env.POSTGRES_URL) {
        console.warn("Running in DB-less dev mode. Skipping sample data creation via API.");
        return;
    }

    // Check if products already exist (via API) to prevent re-adding sample data
    try {
        const productsResponse = await fetch('/api/products', { headers: getApiAuthHeaders() });
        if (productsResponse.ok) {
            const existingProducts = await productsResponse.json();
            if (Array.isArray(existingProducts) && existingProducts.length > 0) {
                console.log("Products already exist, skipping sample data generation.");
                return;
            }
        } else {
            console.error("Failed to fetch existing products to check for sample data generation.");
            // Potentially proceed if the error is transient or if it's a clean DB
        }
    } catch (e) {
        console.error("Error checking existing products:", e);
    }


    console.log("Attempting to add sample data via API...");

    const sampleProductsData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>[] = [
      { name: '全脂牛奶', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, depletionWarningDays: 3, imageUrl: 'https://placehold.co/64x64.png?text=牛奶' },
      { name: '阿拉比卡咖啡豆', category: 'INGREDIENT', unit: '公斤', shelfLifeDays: 365, depletionWarningDays: 14, imageUrl: 'https://placehold.co/64x64.png?text=豆' },
      { name: '香草糖浆', category: 'INGREDIENT', unit: '瓶', shelfLifeDays: 730, depletionWarningDays: 30, imageUrl: 'https://placehold.co/64x64.png?text=糖浆' },
      { name: '马克杯', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null, depletionWarningDays: 5, imageUrl: 'https://placehold.co/64x64.png?text=杯' },
    ];
    
    const createdSampleProducts: Product[] = [];
    for (const pData of sampleProductsData) {
        const newProd = await addProduct({ ...pData, depletionWarningDays: pData.depletionWarningDays! }); // addProduct now expects depletionWarningDays if not using global
        if (newProd) createdSampleProducts.push(newProd);
    }
    
    if (createdSampleProducts.length === 0) {
        console.warn("No sample products were created, skipping batch and transaction sample data.");
        return;
    }

    const milk = createdSampleProducts.find(p => p.name === '全脂牛奶');
    const coffeeBeans = createdSampleProducts.find(p => p.name === '阿拉比卡咖啡豆');
    const vanillaSyrup = createdSampleProducts.find(p => p.name === '香草糖浆');
    const mug = createdSampleProducts.find(p => p.name === '马克杯');

    const sampleBatchesData = [
      ...(milk ? [
        { productId: milk.id, productionDate: formatISO(subDays(new Date(), 30)), initialQuantity: 20, unitCost: 8.5 },
        { productId: milk.id, productionDate: formatISO(subDays(new Date(), 2)), initialQuantity: 15, unitCost: 8.6 },
      ] : []),
      ...(coffeeBeans ? [
        { productId: coffeeBeans.id, productionDate: formatISO(subDays(new Date(), 60)), initialQuantity: 10, unitCost: 120 },
      ] : []),
      ...(vanillaSyrup ? [
        { productId: vanillaSyrup.id, productionDate: formatISO(subDays(new Date(), 90)), initialQuantity: 5, unitCost: 25 },
      ] : []),
      ...(mug ? [
        { productId: mug.id, productionDate: formatISO(subDays(new Date(), 15)), initialQuantity: 50, unitCost: 15 },
      ] : []),
    ];

    const createdSampleBatches: Batch[] = [];
    for (const bData of sampleBatchesData) {
        const newBatch = await addBatch(bData);
        if (newBatch) createdSampleBatches.push(newBatch);
    }

    // Simulate some consumption from last week for analysis demonstration
    const { start: lastWeekStart, end: lastWeekEnd } = getLastFullWeekDateRange();
    const sampleOutflowTransactions: Omit<Transaction, 'id' | 'timestamp'>[] = [];
    const batchQuantitiesToUpdate: Record<string, number> = {};

    if (milk && createdSampleBatches.some(b => b.productId === milk.id)) {
        const milkBatchForOutflow = createdSampleBatches.find(b => b.productId === milk.id && b.initialQuantity > 5); // Find a batch with enough stock
        if (milkBatchForOutflow) {
            const milkConsumedLastWeek = 7; // e.g., 1 liter per day
            sampleOutflowTransactions.push({
                productId: milk.id, productName: milk.name, batchId: milkBatchForOutflow.id, type: 'OUT', quantity: milkConsumedLastWeek, reason: 'SALE', unitCostAtTransaction: milkBatchForOutflow.unitCost, 
                timestamp: formatISO(addDays(lastWeekStart, 3)) // Mid-week
            });
            batchQuantitiesToUpdate[milkBatchForOutflow.id] = (batchQuantitiesToUpdate[milkBatchForOutflow.id] || milkBatchForOutflow.initialQuantity) - milkConsumedLastWeek;
        }
    }
     if (coffeeBeans && createdSampleBatches.some(b => b.productId === coffeeBeans.id)) {
        const coffeeBatchForOutflow = createdSampleBatches.find(b => b.productId === coffeeBeans.id && b.initialQuantity > 2);
        if (coffeeBatchForOutflow) {
            const coffeeConsumedLastWeek = 1.5; // e.g., 1.5 kg
             sampleOutflowTransactions.push({
                productId: coffeeBeans.id, productName: coffeeBeans.name, batchId: coffeeBatchForOutflow.id, type: 'OUT', quantity: coffeeConsumedLastWeek, reason: 'SALE', unitCostAtTransaction: coffeeBatchForOutflow.unitCost,
                timestamp: formatISO(addDays(lastWeekStart, 4))
            });
            batchQuantitiesToUpdate[coffeeBatchForOutflow.id] = (batchQuantitiesToUpdate[coffeeBatchForOutflow.id] || coffeeBatchForOutflow.initialQuantity) - coffeeConsumedLastWeek;
        }
    }

    // Update batch quantities in DB
    for (const batchIdToUpdate in batchQuantitiesToUpdate) {
        const newQuantity = batchQuantitiesToUpdate[batchIdToUpdate];
        if (newQuantity >= 0) {
            try {
                const updateResp = await fetch(`/api/batches/${batchIdToUpdate}`, {
                    method: 'PUT',
                    headers: getApiAuthHeaders(),
                    body: JSON.stringify({ currentQuantity: newQuantity }),
                });
                if (!updateResp.ok) {
                    console.error(`Failed to update sample batch ${batchIdToUpdate} quantity in DB`);
                }
            } catch (e) {
                 console.error(`Error updating sample batch ${batchIdToUpdate} quantity:`, e);
            }
        }
    }
    
    // Add outflow transactions to DB
    for (const txData of sampleOutflowTransactions) {
        await addTransactionAPI({...txData, timestamp: txData.timestamp || formatISO(new Date()) });
    }

    // Refetch all data to ensure UI consistency after sample data manipulation
    await Promise.all([fetchProducts(), fetchBatches(), fetchTransactions()]);
    console.log("Sample data generation complete.");

  }, [addProduct, addBatch, addTransactionAPI, fetchProducts, fetchBatches, fetchTransactions]);


  useEffect(() => {
    // Initialize data fetching when the provider mounts
    Promise.all([
        fetchProducts(),
        fetchBatches(),
        fetchTransactions(),
        fetchAppSettings()
    ]).then(() => {
        // addSampleDataIfNeeded(); // This line can be uncommented to generate sample data
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on mount
  
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

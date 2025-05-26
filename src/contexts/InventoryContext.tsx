
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
    // Ensure depletionWarningDays is part of newSettings or taken from current appSettings
    const settingsToUpdate: AppSettings = {
        expiryWarningDays: newSettings.expiryWarningDays ?? appSettings.expiryWarningDays,
        depletionWarningDays: newSettings.depletionWarningDays ?? appSettings.depletionWarningDays,
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: getApiAuthHeaders(),
        body: JSON.stringify(settingsToUpdate), // Send complete settings object
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || 'Failed to update settings via API');
      }
      const updatedSettingsFromServer: AppSettings = await response.json();
      setAppSettings(updatedSettingsFromServer);
      if (showSuccessToast) {
        toast({ title: "成功", description: "设置已保存。" });
      }
    } catch (error) {
      console.error("Error updating app settings:", error);
      toast({ title: "错误", description: `更新设置失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      // Do not throw error here to prevent unhandled promise rejection if called from useEffect
    }
  }, [appSettings]); // Added appSettings to dependencies


  const fetchAppSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/settings', { headers: getApiAuthHeaders() });
      if (!response.ok) {
        if (response.status === 401) throw new Error('API: Unauthorized to fetch settings.');
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response from API' }));
        throw new Error(errorData.error || `Failed to fetch app settings from API (status: ${response.status})`);
      }
      const data: AppSettings = await response.json();
       if (data && typeof data.expiryWarningDays === 'number' && typeof data.depletionWarningDays === 'number') {
        setAppSettings(data);
      } else {
        console.warn("Fetched app settings were invalid or incomplete, using default and attempting to save defaults.", data);
        setAppSettings(DEFAULT_APP_SETTINGS);
        await updateAppSettings(DEFAULT_APP_SETTINGS, false);
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
      // setProducts(prev => [...prev, newProductFromServer].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      await fetchProducts(); // Refetch all products to ensure sorted list and single source of truth
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
      // const updatedProductFromServer: Product = await response.json();
      await fetchProducts(); // Refetch to update list
      const updatedProductName = updatedProductData.name || products.find(p=>p.id === productId)?.name || '产品';
      
      // If product name changed, we should ideally update productName in all its batches and transactions.
      // For now, just refetching batches to reflect potential name changes from server-side logic if any.
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
      // setProducts(prevProducts =>
      //   prevProducts.map(p => p.id === productId ? updatedProductFromServer : p)
      // );
      await fetchProducts(); // Refetch
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
      // setProducts(prevProducts =>
      //   prevProducts.map(p => p.id === productId ? updatedProductFromServer : p)
      // );
      await fetchProducts(); // Refetch
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
      // setBatches(prev => [...prev, newBatchFromServer].sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));
      await fetchBatches(); // Refetch

      const transactionForNewBatch: Omit<Transaction, 'id'> = {
        productId: newBatchFromServer.productId,
        productName: newBatchFromServer.productName || product.name,
        batchId: newBatchFromServer.id,
        type: 'IN',
        quantity: newBatchFromServer.initialQuantity,
        timestamp: newBatchFromServer.createdAt, // Use batch creation time for IN transaction
        unitCostAtTransaction: newBatchFromServer.unitCost,
        notes: `批次 ${newBatchFromServer.id} 的初始入库`,
        isCorrectionIncrease: false,
      };

      await addTransactionAPI(transactionForNewBatch);
      await fetchTransactions(); // Refetch transactions

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
      // await fetchTransactions(); // Refetch transactions already done by addTransactionAPI if it internally refetches, or do it after batch update

      const batchUpdateResponse = await fetch(`/api/batches/${batchId}`, {
          method: 'PUT',
          headers: getApiAuthHeaders(),
          body: JSON.stringify({ currentQuantity: newCalculatedCurrentQuantity }),
      });

      if (!batchUpdateResponse.ok) {
          const errorData = await batchUpdateResponse.json().catch(() => ({ error: 'Failed to parse error response from batch update API' }));
          // Even if DB update fails for batch, transaction was recorded.
          // To maintain UI consistency with recorded transaction, update local states optimistically but warn user.
          console.error("Transaction recorded, but batch update failed in DB:", errorData.error);
          await fetchBatches(); // Try to refetch to see if somehow it did update or to revert optimistic local change if it fails
          await fetchTransactions(); // ensure transactions list is up-to-date
          toast({ title: "警告: 数据同步可能不一致", description: `交易已记录，但批次 ${batchId} 库存数据库更新失败: ${errorData.error || '未知错误'}。请手动核实。`, variant: "destructive", duration: 10000 });
          return; 
      }

      // const updatedBatchFromServer: Batch = await batchUpdateResponse.json();
      // Update local state with server-confirmed data by refetching
      await fetchBatches();
      await fetchTransactions();


      const successMsg = quantityToOutflow < 0 ?
        `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：${reason}。` :
        `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。原因：${reason}。`;
      toast({ title: "操作成功", description: successMsg });

    } catch (error) {
      console.error("Error recording outflow or updating batch:", error);
      await fetchBatches(); // Attempt to refetch to ensure UI consistency if possible
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
    if (isLoadingProducts || isLoadingBatches || isLoadingTransactions || isLoadingSettings) return null; // Ensure all data is loaded

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
      const depletionDate = addDays(new Date(), daysLeft); // Use current date for prediction base
      predictedDepletionDate = formatISO(depletionDate, { representation: 'date' });
    }

    return {
      avgDailyConsumption: parseFloat(avgDailyConsumption.toFixed(2)),
      predictedDepletionDate,
      daysToDepletion: daysToDepletionNum,
    };
  }, [products, transactions, batches, getProductStockDetails, isLoadingProducts, isLoadingBatches, isLoadingTransactions, isLoadingSettings]);


  const addSampleDataIfNeeded = useCallback(async () => {
    if (process.env.NODE_ENV !== 'development') return; // Only in dev

    // Check if already has significant data
    if (products.length > 2 || batches.length > 5 || transactions.length > 10) {
        console.log("Sufficient data exists, skipping sample data generation.");
        return;
    }
    
    console.log("Attempting to add sample data...");

    const today = new Date();

    const sampleProductsData = [
        { name: "全脂牛奶", category: "INGREDIENT", unit: "升", shelfLifeDays: 7, depletionWarningDays: 3, imageUrl: "https://placehold.co/64x64.png?text=M", notes:"常温奶" },
        { name: "阿拉比卡咖啡豆", category: "INGREDIENT", unit: "公斤", shelfLifeDays: 90, depletionWarningDays: 14, imageUrl: "https://placehold.co/64x64.png?text=C", notes:"中度烘焙" },
        { name: "香草糖浆", category: "INGREDIENT", unit: "瓶", shelfLifeDays: 365, depletionWarningDays: 30, imageUrl: "https://placehold.co/64x64.png?text=S" },
        { name: "马克杯", category: "NON_INGREDIENT", unit: "个", shelfLifeDays: null, depletionWarningDays: 10, imageUrl: "https://placehold.co/64x64.png?text=Mug" },
    ];
    
    const addedProducts: Product[] = [];
    for (const pData of sampleProductsData) {
        // Check if product by this name already exists (simple check)
        const existing = products.find(p => p.name === pData.name);
        if (existing) {
            addedProducts.push(existing);
            continue;
        }
        const newProduct = await addProduct({
            name: pData.name,
            category: pData.category as ProductCategory,
            unit: pData.unit,
            shelfLifeDays: pData.shelfLifeDays,
            imageUrl: pData.imageUrl,
        });
        if (newProduct) addedProducts.push(newProduct);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
    }

    const milkProduct = addedProducts.find(p => p.name === "全脂牛奶");
    const coffeeProduct = addedProducts.find(p => p.name === "阿拉比卡咖啡豆");
    const syrupProduct = addedProducts.find(p => p.name === "香草糖浆");
    const mugProduct = addedProducts.find(p => p.name === "马克杯");

    const sampleBatchesInput: (Omit<Batch, 'id' | 'productName' | 'expiryDate' | 'createdAt' | 'currentQuantity'> & { productionDate: string | null, daysAgo: number, initialQty: number, cost: number })[] = [];

    if (milkProduct) sampleBatchesInput.push({ productId: milkProduct.id, productionDate: formatISO(subDays(today, 30)), initialQty: 20, currentQuantity: 0, unitCost: 6.5, daysAgo: 30, cost: 6.5 });
    if (milkProduct) sampleBatchesInput.push({ productId: milkProduct.id, productionDate: formatISO(subDays(today, 5)), initialQty: 10, currentQuantity: 0, unitCost: 6.8, daysAgo: 5, cost: 6.8 });
    if (coffeeProduct) sampleBatchesInput.push({ productId: coffeeProduct.id, productionDate: formatISO(subDays(today, 60)), initialQty: 50, currentQuantity: 0, unitCost: 80, daysAgo: 60, cost: 80 });
    if (syrupProduct) sampleBatchesInput.push({ productId: syrupProduct.id, productionDate: formatISO(subDays(today, 90)), initialQty: 12, currentQuantity: 0, unitCost: 25, daysAgo: 90, cost: 25 });
    if (mugProduct) sampleBatchesInput.push({ productId: mugProduct.id, productionDate: formatISO(subDays(today, 15)), initialQty: 24, currentQuantity: 0, unitCost: 15, daysAgo: 15, cost: 15 });

    const addedBatches: Batch[] = [];
    for (const bData of sampleBatchesInput) {
        const newB = await addBatch({ 
            productId: bData.productId, 
            productionDate: bData.productionDate, 
            initialQuantity: bData.initialQty, 
            unitCost: bData.cost 
        });
        if (newB) addedBatches.push(newB);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
    }
    
    // Simulate "last week" consumption transactions
    const { start: lastWeekStart, end: lastWeekEnd } = getLastFullWeekDateRange();
    const daysInLastWeek = eachDayOfInterval({ start: lastWeekStart, end: lastWeekEnd });
    
    const sampleOutflowTransactions: Omit<Transaction, 'id' | 'productName' | 'timestamp' | 'unitCostAtTransaction'>[] = [];
    let milkBatchForOutflow = addedBatches.find(b => b.productId === milkProduct?.id && b.initialQuantity === 10); // Use the newer milk batch
    if (!milkBatchForOutflow) milkBatchForOutflow = addedBatches.find(b => b.productId === milkProduct?.id);

    let coffeeBatchForOutflow = addedBatches.find(b => b.productId === coffeeProduct?.id);
    let syrupBatchForOutflow = addedBatches.find(b => b.productId === syrupProduct?.id);

    let milkConsumedLastWeekTotal = 0;
    let coffeeConsumedLastWeekTotal = 0;
    let syrupConsumedLastWeekTotal = 0;

    // Milk: consume 5 units/day for 3 days last week (total 15)
    if (milkProduct && milkBatchForOutflow) {
        for (let i = 0; i < 3; i++) {
            if (daysInLastWeek[i]) {
                const qty = 5;
                sampleOutflowTransactions.push({ productId: milkProduct.id, batchId: milkBatchForOutflow.id, type: 'OUT', quantity: qty, reason: 'SALE', isCorrectionIncrease: false, notes: "示例销售" });
                milkConsumedLastWeekTotal += qty;
            }
        }
    }
    // Coffee: consume 2 units/day for 5 days last week (total 10)
    if (coffeeProduct && coffeeBatchForOutflow) {
        for (let i = 0; i < 5; i++) {
             if (daysInLastWeek[i]) {
                const qty = 2;
                sampleOutflowTransactions.push({ productId: coffeeProduct.id, batchId: coffeeBatchForOutflow.id, type: 'OUT', quantity: qty, reason: 'SALE', isCorrectionIncrease: false, notes: "示例销售" });
                coffeeConsumedLastWeekTotal += qty;
            }
        }
    }
    // Syrup: consume 1 unit/day for 2 days last week (total 2)
    if (syrupProduct && syrupBatchForOutflow) {
        for (let i = 0; i < 2; i++) {
            if (daysInLastWeek[i]) {
                const qty = 1;
                sampleOutflowTransactions.push({ productId: syrupProduct.id, batchId: syrupBatchForOutflow.id, type: 'OUT', quantity: qty, reason: 'INTERNAL_USE', isCorrectionIncrease: false, notes: "示例内部使用" });
                syrupConsumedLastWeekTotal += qty;
            }
        }
    }
    
    // Add these OUT transactions via API AND update batch quantities
    for (const transData of sampleOutflowTransactions) {
        const product = addedProducts.find(p => p.id === transData.productId);
        const batch = addedBatches.find(b => b.id === transData.batchId);
        if (product && batch) {
            const transactionFull: Omit<Transaction, 'id'> = {
                ...transData,
                productName: product.name,
                timestamp: formatISO(daysInLastWeek[Math.floor(Math.random() * daysInLastWeek.length)]), // Random day last week
                unitCostAtTransaction: batch.unitCost,
            };
            await addTransactionAPI(transactionFull);
            
            // Update batch quantity in DB
            const newQuantity = batch.currentQuantity - transData.quantity; // batch.currentQuantity here might be stale if multiple trans for same batch
                                                                        // It's better to fetch the batch again or rely on API to handle atomic updates
                                                                        // For sample data, this approximation might lead to slight inaccuracies if not careful
                                                                        // Let's assume addTransactionAPI (and subsequent fetchBatches) is enough for now or fix in PUT
            
            // To properly update batch quantity, we need to fetch its current state first, or the PUT API should handle decrement.
            // The recordOutflowFromSpecificBatch already does this PUT.
            // For simplicity in sample data, we are directly calling addTransactionAPI.
            // This means the batch quantity in DB isn't reduced by these sample OUT transactions yet.
            // THIS IS THE CORE ISSUE. We need to call the PUT /api/batches/[batchId]
        }
    }

    // Correctly update batch quantities in DB AFTER conceptualizing outflows
    if (milkBatchForOutflow && milkConsumedLastWeekTotal > 0) {
        const finalMilkQty = milkBatchForOutflow.initialQuantity - milkConsumedLastWeekTotal;
        await fetch(`/api/batches/${milkBatchForOutflow.id}`, {
            method: 'PUT', headers: getApiAuthHeaders(), body: JSON.stringify({ currentQuantity: Math.max(0, finalMilkQty) })
        });
    }
    if (coffeeBatchForOutflow && coffeeConsumedLastWeekTotal > 0) {
        const finalCoffeeQty = coffeeBatchForOutflow.initialQuantity - coffeeConsumedLastWeekTotal;
        await fetch(`/api/batches/${coffeeBatchForOutflow.id}`, {
            method: 'PUT', headers: getApiAuthHeaders(), body: JSON.stringify({ currentQuantity: Math.max(0, finalCoffeeQty) })
        });
    }
    if (syrupBatchForOutflow && syrupConsumedLastWeekTotal > 0) {
        const finalSyrupQty = syrupBatchForOutflow.initialQuantity - syrupConsumedLastWeekTotal;
         await fetch(`/api/batches/${syrupBatchForOutflow.id}`, {
            method: 'PUT', headers: getApiAuthHeaders(), body: JSON.stringify({ currentQuantity: Math.max(0, finalSyrupQty) })
        });
    }


    // Refetch all data to reflect sample data additions and updates
    await fetchProducts();
    await fetchBatches();
    await fetchTransactions();
    console.log("Sample data generation complete.");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addProduct, addBatch, addTransactionAPI, products, batches, transactions, fetchProducts, fetchBatches, fetchTransactions ]); // Dependencies need to be robust


  useEffect(() => {
    // Initial data fetch
    Promise.all([
        fetchProducts(),
        fetchBatches(),
        fetchTransactions(),
        fetchAppSettings()
    ]).then(() => {
        // Conditional sample data generation after initial fetch completes and if products are empty
        // This check 'products.length === 0' in addSampleDataIfNeeded will use the state *before* this .then()
        // So, we need to pass the fetched products or adjust the condition.
        // For now, let addSampleDataIfNeeded handle its own checks based on current context state.
        if (process.env.NODE_ENV === 'development') {
           // addSampleDataIfNeeded(); // Removed auto-add
        }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed dependencies to ensure these fetch only once on mount.

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


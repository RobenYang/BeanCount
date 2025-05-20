
"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType, ProductCategory, AppSettings } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO, parseISO, subMonths, differenceInDays, subDays } from 'date-fns';

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
};

interface InventoryContextType {
  products: Product[];
  batches: Batch[]; 
  transactions: Transaction[];
  appSettings: AppSettings;
  isLoadingProducts: boolean;
  isLoadingBatches: boolean;
  isLoadingTransactions: boolean;
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => Promise<void>;
  editProduct: (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => Promise<void>;
  archiveProduct: (productId: string) => Promise<void>;
  unarchiveProduct: (productId: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getMostRecentUnitCost: (productId: string) => number | undefined;
  addBatch: (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => Promise<void>;
  recordOutflowFromSpecificBatch: (productId: string, batchId: string, quantity: number, reason: OutflowReasonValue, notes?: string) => Promise<void>;
  getBatchesByProductId: (productId: string) => Batch[];
  getProductStockDetails: (productId: string) => { totalQuantity: number; totalValue: number; batches: Batch[] };
  updateAppSettings: (newSettings: Partial<AppSettings>) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Removed useLocalStorage for products, batches, transactions as they are API-driven now
const useLocalStorageForSettings = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};


export const InventoryProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  
  const [appSettings, setAppSettings] = useLocalStorageForSettings<AppSettings>('inventory_app_settings_zh_v2', DEFAULT_APP_SETTINGS);

  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error('Failed to fetch products from API');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({ title: "错误", description: "加载产品数据失败。", variant: "destructive" });
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  const fetchBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const response = await fetch('/api/batches');
      if (!response.ok) throw new Error('Failed to fetch batches from API');
      const data: Batch[] = await response.json();
      setBatches(data);
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast({ title: "错误", description: "加载批次数据失败。", variant: "destructive" });
      setBatches([]);
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);
  
  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions');
      if (!response.ok) throw new Error('Failed to fetch transactions from API');
      const data: Transaction[] = await response.json();
      setTransactions(data.map(t => ({...t, timestamp: formatISO(parseISO(t.timestamp))})));
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({ title: "错误", description: "加载交易记录失败。", variant: "destructive" });
      setTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);


  useEffect(() => {
    fetchProducts();
    fetchBatches();
    fetchTransactions();
  }, [fetchProducts, fetchBatches, fetchTransactions]);


  const updateAppSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setAppSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    toast({ title: "成功", description: "设置已保存。" });
  }, [setAppSettings]);

  const addProductAPI = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => {
    // Client-side check for existing product name - can be removed if backend handles this uniquely
    if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase() && !p.isArchived)) {
      toast({ title: "错误", description: `名为 "${productData.name}" 的活动产品已存在。`, variant: "destructive" });
      throw new Error(`Product with name "${productData.name}" already exists.`);
    }
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add product via API');
      }
      const newProductFromServer: Product = await response.json();
      setProducts(prev => [...prev, newProductFromServer].sort((a,b) => a.name.localeCompare(b.name)));
      toast({ title: "成功", description: `产品 "${newProductFromServer.name}" 已添加。` });
      return newProductFromServer; // Return the created product
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ title: "错误", description: `添加产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      throw error; // Re-throw to be caught by caller if needed
    }
  }, [products]);

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProductData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update product ${productId} via API`);
      }
      const updatedProductFromServer: Product = await response.json();
      setProducts(prevProducts => 
        prevProducts.map(p => p.id === productId ? updatedProductFromServer : p)
      );
      toast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已更新。` });
    } catch (error) {
      console.error(`Error editing product ${productId}:`, error);
      toast({ title: "错误", description: `编辑产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, []);

  const archiveProduct = useCallback(async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: true }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to archive product ${productId} via API`);
      }
      const updatedProductFromServer: Product = await response.json();
      setProducts(prevProducts => 
        prevProducts.map(p => p.id === productId ? updatedProductFromServer : p)
      );
      toast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已归档。` });
    } catch (error) {
      console.error(`Error archiving product ${productId}:`, error);
      toast({ title: "错误", description: `归档产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, []);

  const unarchiveProduct = useCallback(async (productId: string) => {
     try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to unarchive product ${productId} via API`);
      }
      const updatedProductFromServer: Product = await response.json();
      setProducts(prevProducts => 
        prevProducts.map(p => p.id === productId ? updatedProductFromServer : p)
      );
      toast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已取消归档。` });
    } catch (error) {
      console.error(`Error unarchiving product ${productId}:`, error);
      toast({ title: "错误", description: `取消归档产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, []);

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0)); // Sort by most recent first
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const addBatchAPI = useCallback(async (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
    const product = getProductById(batchData.productId);
    if (!product) {
      toast({ title: "错误", description: "未找到此批次的产品。", variant: "destructive" });
      throw new Error("Associated product not found for batch.");
    }
    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      toast({ title: "错误", description: "必须为入库批次提供有效的单位成本。", variant: "destructive"});
      throw new Error("Valid unit cost is required.");
    }
    if (batchData.initialQuantity <=0) {
       toast({ title: "错误", description: "接收数量必须大于0。", variant: "destructive"});
       throw new Error("Initial quantity must be > 0.");
    }

    try {
      const batchResponse = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData),
      });

      if (!batchResponse.ok) {
        const errorData = await batchResponse.json();
        throw new Error(errorData.error || 'Failed to add batch via API');
      }
      const newBatchFromServer: Batch = await batchResponse.json();
      setBatches(prev => [...prev, newBatchFromServer].sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime()));

      const transactionForNewBatch: Omit<Transaction, 'id'> = {
        productId: newBatchFromServer.productId,
        productName: newBatchFromServer.productName || product.name, 
        batchId: newBatchFromServer.id,
        type: 'IN',
        quantity: newBatchFromServer.initialQuantity,
        timestamp: newBatchFromServer.createdAt, 
        unitCostAtTransaction: newBatchFromServer.unitCost,
        notes: `批次 ${newBatchFromServer.id} 的初始入库`,
      };
      
      const transactionResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionForNewBatch),
      });

      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json();
        console.error("Batch created, but transaction failed:", errorData.error);
        throw new Error(errorData.error || '批次已创建，但其入库交易记录失败');
      }
      const newTransactionFromServer: Transaction = await transactionResponse.json();
      setTransactions(prev => [newTransactionFromServer, ...prev].sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()));

      toast({ title: "成功", description: `"${newBatchFromServer.productName || product.name}" 的批次已添加。数量: ${newBatchFromServer.initialQuantity}，单位成本: ¥${newBatchFromServer.unitCost.toFixed(2)}` });
      return newBatchFromServer;
    } catch (error) {
      console.error("Error adding batch or its transaction:", error);
      toast({ title: "错误", description: `添加入库批次操作失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
      throw error;
    }
  }, [getProductById, products, batches, transactions]); // products, batches, transactions for context


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
    if (quantityToOutflow > 0) { // Normal outflow
      if (batch.currentQuantity < quantityToOutflow) {
        toast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
        return;
      }
      newCalculatedCurrentQuantity = batch.currentQuantity - quantityToOutflow;
    } else { // Negative outflow, correction increase
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
      const transactionResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactionForOutflow),
      });
      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json();
        throw new Error(errorData.error || 'Failed to add outflow transaction via API');
      }
      const newTransactionFromServer: Transaction = await transactionResponse.json();
      setTransactions(prev => [newTransactionFromServer, ...prev].sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()));
      
      // If transaction recorded successfully, then update batch quantity in DB
      const batchUpdateResponse = await fetch(`/api/batches/${batchId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentQuantity: newCalculatedCurrentQuantity }),
      });

      if (!batchUpdateResponse.ok) {
          const errorData = await batchUpdateResponse.json();
          console.error("Transaction recorded, but batch update failed:", errorData.error);
          toast({ title: "警告: 数据不一致", description: `交易已记录，但批次 ${batchId} 库存更新失败: ${errorData.error || '未知错误'}。请手动核实。`, variant: "destructive", duration: 10000 });
          // Optimistically update local state anyway, but with a strong warning
          setBatches(prevBatches => prevBatches.map(b => b.id === batchId ? { ...b, currentQuantity: newCalculatedCurrentQuantity } : b));
          return; 
      }
      
      const updatedBatchFromServer: Batch = await batchUpdateResponse.json();
      setBatches(prevBatches => prevBatches.map(b => b.id === batchId ? updatedBatchFromServer : b));

      const successMsg = quantityToOutflow < 0 ?
        `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：${reason}。` :
        `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。原因：${reason}。`;
      toast({ title: "操作成功", description: successMsg });

    } catch (error) {
      console.error("Error recording outflow or updating batch:", error);
      toast({ title: "错误", description: `记录出库操作失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [batches, getProductById, products, transactions]);

  const getBatchesByProductId = useCallback((productId: string) => {
    return batches.filter(b => b.productId === productId);
  }, [batches]);

  const getProductStockDetails = useCallback((productId: string) => {
    const productBatches = batches.filter(b => b.productId === productId);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return { totalQuantity, totalValue, batches: productBatches.filter(b => b.currentQuantity > 0) };
  }, [batches]);
  
  useEffect(() => {
    const addSampleDataIfNeeded = async () => {
      // Check if products, batches, AND transactions are loaded and ALL are empty
      if (!isLoadingProducts && products.length === 0 && 
          !isLoadingBatches && batches.length === 0 &&
          !isLoadingTransactions && transactions.length === 0) {
        
        console.log("Attempting to add sample products and batches via API as initial data is empty.");
        
        const sampleProductsToCreate = [
          { name: '阿拉比卡咖啡豆', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365, lowStockThreshold: 10, imageUrl: 'https://placehold.co/100x100.png?text=豆' },
          { name: '全脂牛奶', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, lowStockThreshold: 5, imageUrl: 'https://placehold.co/100x100.png?text=奶' },
          { name: '香草糖浆', category: 'INGREDIENT', unit: '瓶', shelfLifeDays: 730, lowStockThreshold: 2, imageUrl: 'https://placehold.co/100x100.png?text=糖' },
          { name: '马克杯', category: 'NON_INGREDIENT', unit: '个', lowStockThreshold: 5, imageUrl: 'https://placehold.co/100x100.png?text=杯', shelfLifeDays: null },
        ] as Array<Omit<Product, 'id' | 'createdAt' | 'isArchived'>>;

        const createdProducts: Product[] = [];
        for (const pData of sampleProductsToCreate) {
            try {
                const newProd = await addProductAPI(pData); // Use the API-calling addProduct
                if (newProd) createdProducts.push(newProd);
            } catch (e) { /* Error already toasted by addProductAPI */ }
        }
        
        // Wait a moment for product state to potentially update if it wasn't immediate from API response in context
        await new Promise(resolve => setTimeout(resolve, 200));

        const sampleBatchesData = [
          { productNameKey: '阿拉比卡咖啡豆', productionDateOffset: -30, initialQuantity: 10, unitCost: 50, currentQuantityModifier: -2 }, // Consumed 2
          { productNameKey: '阿拉比卡咖啡豆', productionDateOffset: -5, initialQuantity: 5, unitCost: 52, currentQuantityModifier: 0 },
          { productNameKey: '全脂牛奶', productionDateOffset: -7, initialQuantity: 20, unitCost: 8, currentQuantityModifier: -18 }, // Heavily consumed
          { productNameKey: '全脂牛奶', productionDateOffset: -2, initialQuantity: 15, unitCost: 8.5, currentQuantityModifier: -5 },
          { productNameKey: '香草糖浆', productionDateOffset: -60, initialQuantity: 12, unitCost: 25, currentQuantityModifier: -1 },
          { productNameKey: '马克杯', productionDateOffset: -90, initialQuantity: 24, unitCost: 15, currentQuantityModifier: -3 },
        ];

        for (const bData of sampleBatchesData) {
            const product = createdProducts.find(p => p.name === bData.productNameKey);
            if (product) {
                const batchPayload = {
                    productId: product.id,
                    productionDate: product.category === 'INGREDIENT' ? subDays(new Date(), Math.abs(bData.productionDateOffset)).toISOString() : null,
                    initialQuantity: bData.initialQuantity,
                    unitCost: bData.unitCost,
                };
                try {
                    const newBatch = await addBatchAPI(batchPayload); // This now posts to API and creates 'IN' transaction

                    if (newBatch && bData.currentQuantityModifier < 0) { // If some was consumed
                        const outflowQuantity = Math.abs(bData.currentQuantityModifier);
                        if (outflowQuantity > 0 && newBatch.initialQuantity >= outflowQuantity) {
                             // Record an outflow transaction to adjust current quantity for sample data
                            await recordOutflowFromSpecificBatch(
                                product.id,
                                newBatch.id,
                                outflowQuantity,
                                'SALE', // Sample reason
                                '示例数据自动消耗'
                            );
                        }
                    }
                } catch (e) { /* Errors handled by addBatchAPI or recordOutflow */ }
            }
        }
        // Final fetch to ensure all states are aligned after sample data, if needed, or rely on individual updates.
        // For simplicity now, we'll rely on the individual state updates from API calls.
        // Consider a final fetchProducts(), fetchBatches(), fetchTransactions() if inconsistencies are observed.
         await new Promise(resolve => setTimeout(resolve, 500)); // Give API calls time to settle
         fetchProducts();
         fetchBatches();
         fetchTransactions();
      }
    };
    
    const timer = setTimeout(() => {
        addSampleDataIfNeeded();
    }, 1500); 

    return () => clearTimeout(timer);
  }, [isLoadingProducts, products, isLoadingBatches, batches, isLoadingTransactions, transactions, addProductAPI, addBatchAPI, recordOutflowFromSpecificBatch, fetchProducts, fetchBatches, fetchTransactions]);


  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      appSettings,
      isLoadingProducts,
      isLoadingBatches,
      isLoadingTransactions,
      addProduct: addProductAPI,
      editProduct,
      archiveProduct,
      unarchiveProduct,
      getProductById,
      getMostRecentUnitCost,
      addBatch: addBatchAPI,
      recordOutflowFromSpecificBatch,
      getBatchesByProductId,
      getProductStockDetails,
      updateAppSettings,
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

    

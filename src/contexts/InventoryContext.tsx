
"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType, ProductCategory, AppSettings } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO, parseISO, subMonths, differenceInDays, subDays } from 'date-fns'; // Added subDays

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
};

interface InventoryContextType {
  products: Product[];
  batches: Batch[]; 
  transactions: Transaction[]; // Transactions will remain in localStorage for now
  appSettings: AppSettings; // AppSettings will remain in localStorage for now
  isLoadingProducts: boolean;
  isLoadingBatches: boolean;
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

// localStorage hook remains for transactions, and appSettings
const useLocalStorage = <T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
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
  const [batches, setBatches] = useState<Batch[]>([]); // Batches now fetched from API
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true); // New loading state for batches
  
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('inventory_transactions_zh_v2', []);
  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('inventory_app_settings_zh_v2', DEFAULT_APP_SETTINGS);

  // Fetch products from API on mount
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast({ title: "错误", description: "加载产品数据失败。", variant: "destructive" });
        setProducts([]); // Set to empty array on error
      } finally {
        setIsLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  // Fetch batches from API on mount
  useEffect(() => {
    const fetchBatches = async () => {
      setIsLoadingBatches(true);
      try {
        const response = await fetch('/api/batches');
        if (!response.ok) {
          throw new Error('Failed to fetch batches');
        }
        const data: Batch[] = await response.json();
        setBatches(data);
      } catch (error) {
        console.error("Error fetching batches:", error);
        toast({ title: "错误", description: "加载批次数据失败。", variant: "destructive" });
        setBatches([]); // Set to empty array on error
      } finally {
        setIsLoadingBatches(false);
      }
    };
    fetchBatches();
  }, []);


  const updateAppSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setAppSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    toast({ title: "成功", description: "设置已保存。" });
  }, [setAppSettings]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => {
    // Check against API-fetched products
    if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase() && !p.isArchived)) {
      toast({ title: "错误", description: `名为 "${productData.name}" 的活动产品已存在。`, variant: "destructive" });
      return;
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
      const newProductFromServer = await response.json();
      setProducts(prev => [...prev, newProductFromServer]);
      toast({ title: "成功", description: `产品 "${newProductFromServer.name}" 已添加。` });
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ title: "错误", description: `添加产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [products]); // Dependency on products for client-side check

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    // TODO: Implement PUT /api/products/[productId]
    toast({
      title: "功能开发中",
      description: "编辑产品功能需要后端支持，目前修改不会持久保存。",
      variant: "default",
    });
    setProducts(prevProducts => 
        prevProducts.map(p => 
            p.id === productId ? { ...p, ...updatedProductData, shelfLifeDays: updatedProductData.shelfLifeDays !== undefined ? updatedProductData.shelfLifeDays : p.shelfLifeDays } : p
        )
    );
  }, []);

  const archiveProduct = useCallback(async (productId: string) => {
    // TODO: Implement PUT /api/products/[productId]/archive or similar
    toast({
      title: "功能开发中",
      description: "归档产品功能需要后端支持，目前修改不会持久保存。",
      variant: "default",
    });
     setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: true } : p));
  }, []);

  const unarchiveProduct = useCallback(async (productId: string) => {
    // TODO: Implement PUT /api/products/[productId]/unarchive or similar
    toast({
      title: "功能开发中",
      description: "取消归档产品功能需要后端支持，目前修改不会持久保存。",
      variant: "default",
    });
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: false } : p));
  }, []);

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches // Now using API-fetched batches
      .filter(b => b.productId === productId)
      .sort((a, b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const addBatch = useCallback(async (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
    const product = getProductById(batchData.productId); // Uses API-fetched products
    if (!product) {
      toast({ title: "错误", description: "未找到此批次的产品。", variant: "destructive" });
      return;
    }
    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      toast({ title: "错误", description: "必须为入库批次提供有效的单位成本。", variant: "destructive"});
      return;
    }
    if (batchData.initialQuantity <=0) {
       toast({ title: "错误", description: "接收数量必须大于0。", variant: "destructive"});
       return;
    }

    try {
      const response = await fetch('/api/batches', { // Calls the new API endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add batch via API');
      }
      const newBatchFromServer: Batch = await response.json();
      setBatches(prev => [...prev, newBatchFromServer]); // Update local state with API response

      // Still create a local transaction for now. Transaction migration is a separate step.
      const newTransaction: Transaction = {
        id: nanoid(),
        productId: newBatchFromServer.productId,
        productName: product.name, 
        batchId: newBatchFromServer.id,
        type: 'IN',
        quantity: newBatchFromServer.initialQuantity,
        timestamp: newBatchFromServer.createdAt, 
        unitCostAtTransaction: newBatchFromServer.unitCost,
        notes: `批次 ${newBatchFromServer.id} 的初始入库 (API)`,
      };
      setTransactions(prev => [...prev, newTransaction]);
      toast({ title: "成功", description: `"${product.name}" 的批次已添加。数量: ${newBatchFromServer.initialQuantity}，单位成本: ¥${newBatchFromServer.unitCost.toFixed(2)}` });

    } catch (error) {
      console.error("Error adding batch:", error);
      toast({ title: "错误", description: `添加入库批次失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [getProductById, setTransactions, products]); // products dependency added for product.name


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

    const batchIndex = batches.findIndex(b => b.id === batchId && b.productId === productId);
    const batch = batches[batchIndex];
    
    if (quantityToOutflow > 0) {
      if (!batch) { 
         toast({ title: "错误", description: "未找到指定的批次进行出库。", variant: "destructive" });
         return;
      }
      if (batch.currentQuantity < quantityToOutflow) {
        toast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
        return;
      }
    }
    
    // IMPORTANT: Batch quantity update on the server side is NOT implemented in this step.
    // A PUT /api/batches/[batchId] endpoint would be needed.
    // For now, update local state for UI responsiveness and show a toast.
    const updatedBatches = [...batches];
    let actualUnitCostAtTransaction = batch ? batch.unitCost : undefined;

    if (batch) { 
        updatedBatches[batchIndex] = { ...batch, currentQuantity: batch.currentQuantity - quantityToOutflow };
        setBatches(updatedBatches);
         toast({
          title: "提示：本地更新",
          description: "批次数量已在界面更新，但后端数据同步尚未实现。刷新后此更改将丢失。",
          variant: "default",
        });
    } else if (quantityToOutflow < 0) { 
        // For correction (increase), unit cost lookup logic
        const productBatches = batches.filter(b => b.productId === productId).sort((a,b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
        if (productBatches.length > 0) {
            actualUnitCostAtTransaction = productBatches[0].unitCost;
        } else {
            const lastProductTransaction = transactions.filter(t => t.productId === productId && t.unitCostAtTransaction !== undefined).sort((a,b) => (a.timestamp && b.timestamp ? parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime() : 0));
            if (lastProductTransaction.length > 0 && lastProductTransaction[0].unitCostAtTransaction !== undefined) {
                 actualUnitCostAtTransaction = lastProductTransaction[0].unitCostAtTransaction;
            } else {
                 actualUnitCostAtTransaction = 0; // Fallback unit cost
            }
        }
         toast({ // Specific toast for correction when batch might not be locally "updated" for decrease
          title: "提示：本地更正",
          description: "库存更正增加操作已记录，但后端数据同步尚未实现。刷新后此更改将丢失。",
          variant: "default",
        });
    }
    
    const newTransaction: Transaction = {
      id: nanoid(),
      productId: product.id,
      productName: product.name,
      batchId: batchId, 
      type: 'OUT',
      quantity: Math.abs(quantityToOutflow),
      timestamp: formatISO(new Date()),
      reason,
      notes,
      unitCostAtTransaction: actualUnitCostAtTransaction,
      isCorrectionIncrease: quantityToOutflow < 0 ? true : undefined,
    };
    setTransactions(prev => [...prev, newTransaction]); // Transactions still local

    const successMsg = quantityToOutflow < 0 ?
      `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：误操作修正。` :
      `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。`;
    
    // Combine with the general persistence warning
    toast({ title: "操作已记录 (本地)", description: `${successMsg} (此更改未同步到服务器)` });

  }, [batches, getProductById, setTransactions, transactions, products]); // products dependency added

  const getBatchesByProductId = useCallback((productId: string) => {
    return batches.filter(b => b.productId === productId);
  }, [batches]);

  const getProductStockDetails = useCallback((productId: string) => {
    const productBatches = getBatchesByProductId(productId).filter(b => b.currentQuantity > 0);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return { totalQuantity, totalValue, batches: productBatches };
  }, [getBatchesByProductId]);
  
  // Sample Data Generation - Now attempts to add via API after products are loaded
  useEffect(() => {
    const addSampleData = async () => {
      if (!isLoadingProducts && products.length > 0 && !isLoadingBatches && batches.length === 0) {
        console.log("Attempting to add sample batches via API as initial product data is loaded and batches are empty.");
        
        const sampleProductsData: Array<Partial<Product> & { initialBatches?: Array<Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName' | 'productId'> & { productionDateOffsetDays?: number }> }> = [
          { 
            id: products.find(p => p.name.includes("阿拉比卡咖啡豆"))?.id,
            initialBatches: [
              { productionDate: subDays(new Date(), 30).toISOString(), initialQuantity: 10, unitCost: 50 },
              { productionDate: subDays(new Date(), 5).toISOString(), initialQuantity: 5, unitCost: 52 },
            ]
          },
          { 
            id: products.find(p => p.name.includes("全脂牛奶"))?.id,
            initialBatches: [
              { productionDate: subDays(new Date(), 7).toISOString(), initialQuantity: 20, unitCost: 8 },
              { productionDate: subDays(new Date(), 2).toISOString(), initialQuantity: 15, unitCost: 8.5 },
            ]
          },
          {
            id: products.find(p => p.name.includes("香草糖浆"))?.id,
            initialBatches: [
              { productionDate: subDays(new Date(), 60).toISOString(), initialQuantity: 12, unitCost: 25 },
            ]
          },
          { // Non-ingredient example
            id: products.find(p => p.name.includes("马克杯"))?.id,
            initialBatches: [
              { productionDate: subDays(new Date(), 90).toISOString(), initialQuantity: 24, unitCost: 15 },
            ]
          }
        ];

        for (const pData of sampleProductsData) {
          if (pData.id && pData.initialBatches) {
            for (const batchDetail of pData.initialBatches) {
              await addBatch({
                productId: pData.id,
                productionDate: batchDetail.productionDate,
                initialQuantity: batchDetail.initialQuantity,
                unitCost: batchDetail.unitCost,
              });
            }
          }
        }
        // Optionally, fetch batches again after adding samples to ensure UI consistency
        // However, addBatch already updates local state, so this might not be strictly necessary
        // unless there's a specific reason to re-sync everything immediately.
        // Example:
        // const response = await fetch('/api/batches');
        // const data: Batch[] = await response.json();
        // setBatches(data);
      }
    };
    
    addSampleData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingProducts, products, isLoadingBatches, batches]); // addBatch removed from deps to prevent re-triggering


  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      appSettings,
      isLoadingProducts,
      isLoadingBatches,
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

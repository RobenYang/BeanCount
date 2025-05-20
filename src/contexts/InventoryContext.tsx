
"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType, ProductCategory, AppSettings } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO, parseISO } from 'date-fns';

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
};

interface InventoryContextType {
  products: Product[];
  batches: Batch[]; // Batches will remain in localStorage for now
  transactions: Transaction[]; // Transactions will remain in localStorage for now
  appSettings: AppSettings; // AppSettings will remain in localStorage for now
  isLoadingProducts: boolean;
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => Promise<void>;
  editProduct: (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => Promise<void>;
  archiveProduct: (productId: string) => Promise<void>;
  unarchiveProduct: (productId: string) => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getMostRecentUnitCost: (productId: string) => number | undefined;
  addBatch: (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => void;
  recordOutflowFromSpecificBatch: (productId: string, batchId: string, quantity: number, reason: OutflowReasonValue, notes?: string) => void;
  getBatchesByProductId: (productId: string) => Batch[];
  getProductStockDetails: (productId: string) => { totalQuantity: number; totalValue: number; batches: Batch[] };
  updateAppSettings: (newSettings: Partial<AppSettings>) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// localStorage hook remains for batches, transactions, and appSettings
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
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  
  // Batches, transactions, and appSettings continue to use localStorage for now
  const [batches, setBatches] = useLocalStorage<Batch[]>('inventory_batches_zh_v2', []);
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


  const updateAppSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setAppSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    toast({ title: "成功", description: "设置已保存。" });
  }, [setAppSettings]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => {
    // Client-side check for uniqueness (can be enhanced on backend)
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
  }, [products, setProducts]);

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    toast({
      title: "功能迁移中",
      description: "编辑产品功能正在迁移至新后端，目前暂不可用。",
      variant: "default",
    });
    // Placeholder for API call:
    // try {
    //   const response = await fetch(`/api/products/${productId}`, { // hypothetical endpoint
    //     method: 'PUT',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(updatedProductData),
    //   });
    //   if (!response.ok) throw new Error('Failed to edit product');
    //   const updatedProductFromServer = await response.json();
    //   setProducts(prevProducts => prevProducts.map(p => (p.id === productId ? updatedProductFromServer : p)));
    //   toast({ title: "成功", description: `产品 "${updatedProductFromServer.name}" 已更新。` });
    // } catch (error) {
    //   console.error("Error editing product:", error);
    //   toast({ title: "错误", description: "编辑产品失败。", variant: "destructive" });
    // }
  }, []);

  const archiveProduct = useCallback(async (productId: string) => {
    toast({
      title: "功能迁移中",
      description: "归档产品功能正在迁移至新后端，目前暂不可用。",
      variant: "default",
    });
    // Placeholder for API call:
    // try {
    //   const response = await fetch(`/api/products/${productId}/archive`, { method: 'POST' }); // hypothetical endpoint
    //   if (!response.ok) throw new Error('Failed to archive product');
    //   setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: true } : p));
    //   toast({ title: "成功", description: "产品已归档。" });
    // } catch (error) {
    //   console.error("Error archiving product:", error);
    //   toast({ title: "错误", description: "归档产品失败。", variant: "destructive" });
    // }
  }, []);

  const unarchiveProduct = useCallback(async (productId: string) => {
    toast({
      title: "功能迁移中",
      description: "取消归档产品功能正在迁移至新后端，目前暂不可用。",
      variant: "default",
    });
    // Placeholder for API call:
    // try {
    //   const response = await fetch(`/api/products/${productId}/unarchive`, { method: 'POST' }); // hypothetical endpoint
    //   if (!response.ok) throw new Error('Failed to unarchive product');
    //   setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: false } : p));
    //   toast({ title: "成功", description: "产品已取消归档。" });
    // } catch (error) {
    //   console.error("Error unarchiving product:", error);
    //   toast({ title: "错误", description: "取消归档产品失败。", variant: "destructive" });
    // }
  }, []);

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  // This function will continue to use localStorage batches for now.
  // This might lead to inconsistencies if product data is from API and batch data from localStorage.
  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  // Batch and transaction logic remains largely unchanged and continues to use localStorage
  const addBatch = useCallback((batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
    const product = getProductById(batchData.productId); // product is now from API-fed state
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

    const batchCreatedAt = formatISO(new Date());
    let productionDateIso: string | null = null;
    let expiryDateIso: string | null = null;

    if (product.category === 'INGREDIENT') {
      if (!batchData.productionDate) {
        toast({ title: "错误", description: "食材类产品必须提供生产日期。", variant: "destructive" });
        return;
      }
      try {
        productionDateIso = formatISO(parseISO(batchData.productionDate));
        if (product.shelfLifeDays && product.shelfLifeDays > 0) {
          expiryDateIso = formatISO(addDays(parseISO(batchData.productionDate), product.shelfLifeDays));
        }
      } catch (e) {
        toast({ title: "错误", description: "生产日期格式无效。", variant: "destructive" });
        return;
      }
    } else { 
      productionDateIso = batchData.productionDate ? formatISO(parseISO(batchData.productionDate)) : formatISO(new Date()); // Default to now if not provided for non-ingredient
      expiryDateIso = null; 
    }

    const newBatch: Batch = {
      id: nanoid(),
      productId: batchData.productId,
      productName: product.name,
      productionDate: productionDateIso,
      expiryDate: expiryDateIso,
      initialQuantity: batchData.initialQuantity,
      currentQuantity: batchData.initialQuantity,
      unitCost: batchData.unitCost,
      createdAt: batchCreatedAt,
    };
    setBatches(prev => [...prev, newBatch]);

    const newTransaction: Transaction = {
      id: nanoid(),
      productId: newBatch.productId,
      productName: product.name,
      batchId: newBatch.id,
      type: 'IN',
      quantity: newBatch.initialQuantity,
      timestamp: batchCreatedAt,
      unitCostAtTransaction: newBatch.unitCost,
      notes: `批次 ${newBatch.id} 的初始入库`,
    };
    setTransactions(prev => [...prev, newTransaction]);
    toast({ title: "成功", description: `"${product.name}" 的批次已添加。数量: ${newBatch.initialQuantity}，单位成本: ¥${newBatch.unitCost.toFixed(2)}` });
  }, [getProductById, setBatches, setTransactions, batches]); // Added batches to dependencies of addBatch

  const recordOutflowFromSpecificBatch = useCallback((productId: string, batchId: string, quantityToOutflow: number, reason: OutflowReasonValue, notes?: string) => {
    const product = getProductById(productId); // product is now from API-fed state
    if (!product) {
      toast({ title: "错误", description: "未找到产品。", variant: "destructive" });
      return;
    }
     if (quantityToOutflow === 0) {
        toast({ title: "错误", description: "出库数量不能为零。", variant: "destructive" });
        return;
    }

    const batchIndex = batches.findIndex(b => b.id === batchId && b.productId === productId);
    if (batchIndex === -1 && quantityToOutflow > 0) {
      toast({ title: "错误", description: "未找到指定的批次。", variant: "destructive" });
      return;
    }
    
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
    
    const updatedBatches = [...batches];
    let actualUnitCostAtTransaction = batch ? batch.unitCost : undefined;

    if (batch) { 
        updatedBatches[batchIndex] = { ...batch, currentQuantity: batch.currentQuantity - quantityToOutflow };
    } else if (quantityToOutflow < 0) { 
        // Try to find a unit cost for correction if batch doesn't exist (e.g. full batch correction)
        const productBatches = batches.filter(b => b.productId === productId).sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
        if (productBatches.length > 0) {
            actualUnitCostAtTransaction = productBatches[0].unitCost;
        } else {
            // Fallback to last transaction cost if no batches exist
            const lastProductTransaction = transactions.filter(t => t.productId === productId && t.unitCostAtTransaction !== undefined).sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
            if (lastProductTransaction.length > 0 && lastProductTransaction[0].unitCostAtTransaction !== undefined) {
                 actualUnitCostAtTransaction = lastProductTransaction[0].unitCostAtTransaction;
            } else {
                 actualUnitCostAtTransaction = 0; // Default to 0 if no cost can be determined
            }
        }
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

    setBatches(updatedBatches);
    setTransactions(prev => [...prev, newTransaction]);

    if (quantityToOutflow < 0) {
      toast({ title: "成功", description: `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：误操作修正。` });
    } else {
      toast({ title: "成功", description: `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。` });
    }
  }, [batches, getProductById, setBatches, setTransactions, transactions]); // Added transactions dependency

  const getBatchesByProductId = useCallback((productId: string) => {
    return batches.filter(b => b.productId === productId);
  }, [batches]);

  const getProductStockDetails = useCallback((productId: string) => {
    const productBatches = getBatchesByProductId(productId).filter(b => b.currentQuantity > 0);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return { totalQuantity, totalValue, batches: productBatches };
  }, [getBatchesByProductId]);
  
  // Removed sample data generation effect for products, as they come from API now.
  // Sample data for batches and transactions could remain if needed for testing those parts,
  // but ensure it doesn't conflict with API-driven product IDs.
  // For simplicity in this step, I am removing all sample data generation from here.
  // The API route /api/products/route.ts provides its own initial sample products.

  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      appSettings,
      isLoadingProducts,
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

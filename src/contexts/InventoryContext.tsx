
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
  const [batches, setBatches] = useState<Batch[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true);
  
  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('inventory_app_settings_zh_v2', DEFAULT_APP_SETTINGS);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const response = await fetch('/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast({ title: "错误", description: "加载产品数据失败。", variant: "destructive" });
        setProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchBatches = async () => {
      setIsLoadingBatches(true);
      try {
        const response = await fetch('/api/batches');
        if (!response.ok) throw new Error('Failed to fetch batches');
        const data: Batch[] = await response.json();
        setBatches(data);
      } catch (error) {
        console.error("Error fetching batches:", error);
        toast({ title: "错误", description: "加载批次数据失败。", variant: "destructive" });
        setBatches([]);
      } finally {
        setIsLoadingBatches(false);
      }
    };
    fetchBatches();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoadingTransactions(true);
      try {
        const response = await fetch('/api/transactions');
        if (!response.ok) throw new Error('Failed to fetch transactions');
        const data: Transaction[] = await response.json();
        setTransactions(data.map(t => ({...t, timestamp: formatISO(parseISO(t.timestamp))}))); // Ensure ISO format
      } catch (error) {
        console.error("Error fetching transactions:", error);
        toast({ title: "错误", description: "加载交易记录失败。", variant: "destructive" });
        setTransactions([]);
      } finally {
        setIsLoadingTransactions(false);
      }
    };
    fetchTransactions();
  }, []);


  const updateAppSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setAppSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    toast({ title: "成功", description: "设置已保存。" });
  }, [setAppSettings]);

  const addProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => {
    // Client-side check for existing product name
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
      const newProductFromServer: Product = await response.json();
      setProducts(prev => [...prev, newProductFromServer]);
      toast({ title: "成功", description: `产品 "${newProductFromServer.name}" 已添加。` });
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ title: "错误", description: `添加产品失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [products]); // Added products to dependency array for the client-side check

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    toast({
      title: "功能开发中",
      description: "编辑产品功能需要后端支持 (PUT /api/products/[productId])，目前修改不会持久保存到数据库。",
      variant: "default",
    });
    // Optimistic UI update
    setProducts(prevProducts => 
        prevProducts.map(p => 
            p.id === productId ? { ...p, ...updatedProductData, shelfLifeDays: updatedProductData.shelfLifeDays !== undefined ? updatedProductData.shelfLifeDays : p.shelfLifeDays } : p
        )
    );
  }, []);

  const archiveProduct = useCallback(async (productId: string) => {
    toast({
      title: "功能开发中",
      description: "归档产品功能需要后端支持 (e.g., PUT /api/products/[productId])，目前修改不会持久保存到数据库。",
      variant: "default",
    });
     setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: true } : p));
  }, []);

  const unarchiveProduct = useCallback(async (productId: string) => {
    toast({
      title: "功能开发中",
      description: "取消归档产品功能需要后端支持 (e.g., PUT /api/products/[productId])，目前修改不会持久保存到数据库。",
      variant: "default",
    });
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: false } : p));
  }, []);

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const addBatch = useCallback(async (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
    const product = getProductById(batchData.productId); // Fetches product from local state (which is from API)
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
      const batchResponse = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchData), // API will fetch product details from DB to calc expiry etc.
      });

      if (!batchResponse.ok) {
        const errorData = await batchResponse.json();
        throw new Error(errorData.error || 'Failed to add batch via API');
      }
      const newBatchFromServer: Batch = await batchResponse.json();
      setBatches(prev => [...prev, newBatchFromServer]);

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
        // Consider how to handle: if batch creation succeeded but transaction failed.
        // For now, just log and toast. A more robust solution might involve rollback.
        console.error("Batch created, but transaction failed:", errorData.error);
        throw new Error(errorData.error || '批次已创建，但其入库交易记录失败');
      }
      const newTransactionFromServer: Transaction = await transactionResponse.json();
      setTransactions(prev => [newTransactionFromServer, ...prev].sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()));

      toast({ title: "成功", description: `"${newBatchFromServer.productName || product.name}" 的批次已添加。数量: ${newBatchFromServer.initialQuantity}，单位成本: ¥${newBatchFromServer.unitCost.toFixed(2)}` });

    } catch (error) {
      console.error("Error adding batch or its transaction:", error);
      toast({ title: "错误", description: `添加入库批次操作失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }
  }, [getProductById, products]);


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
    
    if (!batch) { 
       toast({ title: "错误", description: "未找到指定的批次进行出库。", variant: "destructive" });
       return;
    }

    let newCurrentQuantity = batch.currentQuantity;
    if (quantityToOutflow > 0) { // Normal outflow, decrease stock
      if (batch.currentQuantity < quantityToOutflow) {
        toast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
        return;
      }
      newCurrentQuantity = batch.currentQuantity - quantityToOutflow;
    } else { // Negative outflow, correction increase stock
      newCurrentQuantity = batch.currentQuantity + Math.abs(quantityToOutflow);
    }
    
    // Create transaction first
    const transactionForOutflow: Omit<Transaction, 'id'> = {
      productId: product.id,
      productName: product.name,
      batchId: batchId, 
      type: 'OUT',
      quantity: Math.abs(quantityToOutflow),
      timestamp: formatISO(new Date()),
      reason,
      notes,
      unitCostAtTransaction: batch.unitCost, // Use batch's unit cost
      isCorrectionIncrease: quantityToOutflow < 0 ? true : undefined,
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
          body: JSON.stringify({ currentQuantity: newCurrentQuantity }),
      });

      if (!batchUpdateResponse.ok) {
          const errorData = await batchUpdateResponse.json();
          // Potentially rollback transaction or notify user of inconsistency
          console.error("Transaction recorded, but batch update failed:", errorData.error);
          toast({ title: "警告: 数据不一致", description: `交易已记录，但批次 ${batchId} 库存更新失败: ${errorData.error || '未知错误'}。请手动核实。`, variant: "destructive", duration: 10000 });
          // For now, update local state optimistically anyway, but with a strong warning
          const updatedBatches = [...batches];
          updatedBatches[batchIndex] = { ...batch, currentQuantity: newCurrentQuantity };
          setBatches(updatedBatches);
          return; 
      }
      
      // Update local batch state after successful DB update
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
  }, [batches, getProductById, products]); // Added products to dependency

  const getBatchesByProductId = useCallback((productId: string) => {
    return batches.filter(b => b.productId === productId);
  }, [batches]);

  const getProductStockDetails = useCallback((productId: string) => {
    const productBatches = getBatchesByProductId(productId); // No longer filtering by currentQuantity > 0 here, API will send all
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    // Return batches with currentQuantity > 0 for display in most UIs
    return { totalQuantity, totalValue, batches: productBatches.filter(b => b.currentQuantity > 0) };
  }, [getBatchesByProductId, batches]); // Added batches as dependency
  
  useEffect(() => {
    const addSampleData = async () => {
      // Only add sample data if products, batches AND transactions are all loaded and all empty
      if (!isLoadingProducts && products.length === 0 && 
          !isLoadingBatches && batches.length === 0 &&
          !isLoadingTransactions && transactions.length === 0) {
        
        console.log("Attempting to add sample products and batches via API as initial data is empty.");
        
        const sampleProductsToCreate = [
          { name: '阿拉比卡咖啡豆', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365, lowStockThreshold: 10, imageUrl: 'https://placehold.co/100x100.png?text=豆' },
          { name: '全脂牛奶', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, lowStockThreshold: 5, imageUrl: 'https://placehold.co/100x100.png?text=奶' },
          { name: '香草糖浆', category: 'INGREDIENT', unit: '瓶', shelfLifeDays: 730, lowStockThreshold: 2, imageUrl: 'https://placehold.co/100x100.png?text=糖' },
          { name: '马克杯', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null, lowStockThreshold: 5, imageUrl: 'https://placehold.co/100x100.png?text=杯' },
        ] as Array<Omit<Product, 'id' | 'createdAt' | 'isArchived'>>;

        const createdProductMap: Map<string, Product> = new Map();

        for (const pData of sampleProductsToCreate) {
          try {
            // Simulate addProduct without directly calling it to avoid re-triggering this effect if products state updates
            const response = await fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pData),
            });
            if (response.ok) {
              const newProd: Product = await response.json();
              createdProductMap.set(pData.name, newProd);
            } else {
              console.error(`Failed to add sample product ${pData.name}:`, await response.text());
            }
          } catch (e) {
            console.error(`Error adding sample product ${pData.name}:`, e);
          }
        }
        
        // Update local products state once after all API calls
        setProducts(Array.from(createdProductMap.values()));

        // Wait for products state to potentially update if needed, or for API to settle.
        await new Promise(resolve => setTimeout(resolve, 100));


        const sampleBatchesData = [
            { productName: '阿拉比卡咖啡豆', productionDateOffset: -30, initialQuantity: 10, unitCost: 50 },
            { productName: '阿拉比卡咖啡豆', productionDateOffset: -5, initialQuantity: 5, unitCost: 52 },
            { productName: '全脂牛奶', productionDateOffset: -7, initialQuantity: 20, unitCost: 8 },
            { productName: '全脂牛奶', productionDateOffset: -2, initialQuantity: 15, unitCost: 8.5 },
            { productName: '香草糖浆', productionDateOffset: -60, initialQuantity: 12, unitCost: 25 },
            { productName: '马克杯', productionDateOffset: -90, initialQuantity: 24, unitCost: 15 },
        ];

        const createdBatchesMap: Map<string, Batch> = new Map();

        for (const bData of sampleBatchesData) {
            const product = createdProductMap.get(bData.productName);
            if (product) {
                const batchPayload = {
                    productId: product.id,
                    productionDate: product.category === 'INGREDIENT' ? subDays(new Date(), Math.abs(bData.productionDateOffset)).toISOString() : null,
                    initialQuantity: bData.initialQuantity,
                    unitCost: bData.unitCost,
                };
                 try {
                    // Simulate addBatch without calling it to avoid re-triggering effects within this block
                    const batchResponse = await fetch('/api/batches', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(batchPayload),
                    });
                     if (batchResponse.ok) {
                        const newBatch: Batch = await batchResponse.json();
                        createdBatchesMap.set(newBatch.id, newBatch);
                        
                        const transactionForNewBatch: Omit<Transaction, 'id'> = {
                            productId: newBatch.productId,
                            productName: newBatch.productName || product.name,
                            batchId: newBatch.id,
                            type: 'IN',
                            quantity: newBatch.initialQuantity,
                            timestamp: newBatch.createdAt,
                            unitCostAtTransaction: newBatch.unitCost,
                            notes: `批次 ${newBatch.id} 的初始入库 (示例数据)`,
                        };
                        const transactionResponse = await fetch('/api/transactions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(transactionForNewBatch),
                        });
                        if (!transactionResponse.ok) {
                             console.error(`Failed to add transaction for sample batch ${newBatch.id}:`, await transactionResponse.text());
                        }
                    } else {
                        console.error(`Failed to add sample batch for ${product.name}:`, await batchResponse.text());
                    }
                } catch (e) {
                    console.error(`Error adding sample batch for ${product.name}:`, e);
                }
            }
        }
        // Update local batches state once
        setBatches(Array.from(createdBatchesMap.values()));

        // Re-fetch all data at the end to ensure UI consistency with DB
        // This is a bit heavy but ensures all states are aligned after sample data setup
        setIsLoadingProducts(true); setIsLoadingBatches(true); setIsLoadingTransactions(true);
        try {
            const [prodRes, batchRes, transRes] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/batches'),
                fetch('/api/transactions')
            ]);
            if (prodRes.ok) setProducts(await prodRes.json()); else console.error("Failed to re-fetch products after sample data");
            if (batchRes.ok) setBatches(await batchRes.json()); else console.error("Failed to re-fetch batches after sample data");
            if (transRes.ok) setTransactions((await transRes.json()).map((t:Transaction) => ({...t, timestamp: formatISO(parseISO(t.timestamp))}))); else console.error("Failed to re-fetch transactions after sample data");
        } catch (e) {
            console.error("Error re-fetching data after sample generation", e);
        } finally {
            setIsLoadingProducts(false); setIsLoadingBatches(false); setIsLoadingTransactions(false);
        }
      }
    };
    
    // Debounce or gate sample data addition to prevent multiple runs if components re-render quickly
    const timer = setTimeout(() => {
        addSampleData();
    }, 1000); // Wait a second to ensure initial loads are likely complete

    return () => clearTimeout(timer); // Cleanup timer
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingProducts, isLoadingBatches, isLoadingTransactions]); // Removed products, batches, transactions from deps to control sample data generation more explicitly


  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      appSettings,
      isLoadingProducts,
      isLoadingBatches,
      isLoadingTransactions,
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

    
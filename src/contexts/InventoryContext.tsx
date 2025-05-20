
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
  isLoadingTransactions: boolean; // New loading state for transactions
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
  const [transactions, setTransactions] = useState<Transaction[]>([]); // Transactions now fetched from API
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState<boolean>(true); // New loading state
  
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
        setTransactions(data);
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
  }, [products]);

  const editProduct = useCallback(async (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
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
    toast({
      title: "功能开发中",
      description: "归档产品功能需要后端支持，目前修改不会持久保存。",
      variant: "default",
    });
     setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: true } : p));
  }, []);

  const unarchiveProduct = useCallback(async (productId: string) => {
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
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const addBatch = useCallback(async (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
    const product = getProductById(batchData.productId);
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
        body: JSON.stringify(batchData),
      });

      if (!batchResponse.ok) {
        const errorData = await batchResponse.json();
        throw new Error(errorData.error || 'Failed to add batch via API');
      }
      const newBatchFromServer: Batch = await batchResponse.json();
      setBatches(prev => [...prev, newBatchFromServer]);

      const transactionForNewBatch: Omit<Transaction, 'id'> = {
        productId: newBatchFromServer.productId,
        productName: product.name, 
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
        throw new Error(errorData.error || 'Failed to add transaction via API');
      }
      const newTransactionFromServer: Transaction = await transactionResponse.json();
      setTransactions(prev => [newTransactionFromServer, ...prev]); // Add to start for chronological order on page

      toast({ title: "成功", description: `"${product.name}" 的批次已添加。数量: ${newBatchFromServer.initialQuantity}，单位成本: ¥${newBatchFromServer.unitCost.toFixed(2)}` });

    } catch (error) {
      console.error("Error adding batch or its transaction:", error);
      toast({ title: "错误", description: `添加入库批次或其交易记录失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
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
    
    let actualUnitCostAtTransaction = batch ? batch.unitCost : undefined;

    if (quantityToOutflow > 0) {
      if (!batch) { 
         toast({ title: "错误", description: "未找到指定的批次进行出库。", variant: "destructive" });
         return;
      }
      if (batch.currentQuantity < quantityToOutflow) {
        toast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
        return;
      }
       // TODO: Implement PUT /api/batches/[batchId] to update currentQuantity on server
       // For now, update local state for UI responsiveness and show a toast.
      const updatedBatches = [...batches];
      updatedBatches[batchIndex] = { ...batch, currentQuantity: batch.currentQuantity - quantityToOutflow };
      setBatches(updatedBatches);
      toast({
        title: "提示：批次数量本地更新",
        description: "批次数量已在界面更新，但后端数据同步尚未实现。刷新后此更改将丢失。",
        variant: "default",
      });

    } else if (quantityToOutflow < 0) { 
        const productBatches = batches.filter(b => b.productId === productId).sort((a,b) => (a.createdAt && b.createdAt ? parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime() : 0));
        if (productBatches.length > 0) {
            actualUnitCostAtTransaction = productBatches[0].unitCost;
        } else {
            const lastProductTransaction = transactions.filter(t => t.productId === productId && t.unitCostAtTransaction !== undefined).sort((a,b) => (a.timestamp && b.timestamp ? parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime() : 0));
            if (lastProductTransaction.length > 0 && lastProductTransaction[0].unitCostAtTransaction !== undefined) {
                 actualUnitCostAtTransaction = lastProductTransaction[0].unitCostAtTransaction;
            } else {
                 actualUnitCostAtTransaction = 0; 
            }
        }
         toast({ 
          title: "提示：库存更正本地更新",
          description: "库存更正增加操作已在界面反应，但后端批次数量同步尚未实现。刷新后此更改将丢失。",
          variant: "default",
        });
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
      unitCostAtTransaction: actualUnitCostAtTransaction,
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
      setTransactions(prev => [newTransactionFromServer, ...prev]);

      const successMsg = quantityToOutflow < 0 ?
        `为批次 ${batchId} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：误操作修正。` :
        `从批次 ${batchId} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。`;
      toast({ title: "交易已记录 (服务器)", description: successMsg });

    } catch (error) {
      console.error("Error adding outflow transaction:", error);
      toast({ title: "错误", description: `记录出库交易失败: ${error instanceof Error ? error.message : '未知错误'}`, variant: "destructive" });
    }

  }, [batches, getProductById, transactions, products]);

  const getBatchesByProductId = useCallback((productId: string) => {
    return batches.filter(b => b.productId === productId);
  }, [batches]);

  const getProductStockDetails = useCallback((productId: string) => {
    const productBatches = getBatchesByProductId(productId).filter(b => b.currentQuantity > 0);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return { totalQuantity, totalValue, batches: productBatches };
  }, [getBatchesByProductId]);
  
  useEffect(() => {
    const addSampleData = async () => {
      if (!isLoadingProducts && products.length === 0 && !isLoadingBatches && batches.length === 0 && !isLoadingTransactions && transactions.length === 0) {
        console.log("Attempting to add sample products and batches via API as initial data is empty.");
        
        const sampleProductsToCreate = [
          { name: '阿拉比卡咖啡豆', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365, lowStockThreshold: 10, imageUrl: 'https://placehold.co/100x100.png?text=豆' },
          { name: '全脂牛奶', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, lowStockThreshold: 5, imageUrl: 'https://placehold.co/100x100.png?text=奶' },
          { name: '香草糖浆', category: 'INGREDIENT', unit: '瓶', shelfLifeDays: 730, lowStockThreshold: 2, imageUrl: 'https://placehold.co/100x100.png?text=糖' },
          { name: '马克杯', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null, lowStockThreshold: 5, imageUrl: 'https://placehold.co/100x100.png?text=杯' },
        ] as Array<Omit<Product, 'id' | 'createdAt' | 'isArchived'>>;

        const createdProductIds: { [key: string]: string } = {};

        for (const pData of sampleProductsToCreate) {
          try {
            const response = await fetch('/api/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pData),
            });
            if (response.ok) {
              const newProd: Product = await response.json();
              createdProductIds[pData.name] = newProd.id;
              setProducts(prev => [...prev, newProd]); // Optimistically update local state
            } else {
              console.error(`Failed to add sample product ${pData.name}:`, await response.text());
            }
          } catch (e) {
            console.error(`Error adding sample product ${pData.name}:`, e);
          }
        }
        
        // Wait a moment for products to be potentially available for batch creation if IDs are needed immediately
        // This is a simplification; a more robust way would be to ensure addProduct resolves before addBatch is called for that product.
        await new Promise(resolve => setTimeout(resolve, 500));


        if (createdProductIds['阿拉比卡咖啡豆']) {
            await addBatch({ productId: createdProductIds['阿拉比卡咖啡豆'], productionDate: subDays(new Date(), 30).toISOString(), initialQuantity: 10, unitCost: 50 });
            await addBatch({ productId: createdProductIds['阿拉比卡咖啡豆'], productionDate: subDays(new Date(), 5).toISOString(), initialQuantity: 5, unitCost: 52 });
        }
        if (createdProductIds['全脂牛奶']) {
            await addBatch({ productId: createdProductIds['全脂牛奶'], productionDate: subDays(new Date(), 7).toISOString(), initialQuantity: 20, unitCost: 8 });
            await addBatch({ productId: createdProductIds['全脂牛奶'], productionDate: subDays(new Date(), 2).toISOString(), initialQuantity: 15, unitCost: 8.5 });
        }
         if (createdProductIds['香草糖浆']) {
            await addBatch({ productId: createdProductIds['香草糖浆'], productionDate: subDays(new Date(), 60).toISOString(), initialQuantity: 12, unitCost: 25 });
        }
        if (createdProductIds['马克杯']) {
            await addBatch({ productId: createdProductIds['马克杯'], productionDate: subDays(new Date(), 90).toISOString(), initialQuantity: 24, unitCost: 15 });
        }

        // Re-fetch all data to ensure consistency after sample data generation
        // This is a bit heavy-handed but ensures UI reflects DB state after complex initial setup.
        setIsLoadingProducts(true); setIsLoadingBatches(true); setIsLoadingTransactions(true);
        try {
            const [prodRes, batchRes, transRes] = await Promise.all([
                fetch('/api/products'),
                fetch('/api/batches'),
                fetch('/api/transactions')
            ]);
            if (prodRes.ok) setProducts(await prodRes.json());
            if (batchRes.ok) setBatches(await batchRes.json());
            if (transRes.ok) setTransactions(await transRes.json());
        } catch (e) {
            console.error("Error re-fetching data after sample generation", e);
        } finally {
            setIsLoadingProducts(false); setIsLoadingBatches(false); setIsLoadingTransactions(false);
        }
      }
    };
    
    addSampleData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingProducts, isLoadingBatches, isLoadingTransactions]);


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


"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType, ProductCategory, AppSettings } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO, parseISO } from 'date-fns';

const DEFAULT_APP_SETTINGS: AppSettings = {
  lowStockThreshold: 5,
  expiryWarningDays: 7,
};

interface InventoryContextType {
  products: Product[];
  batches: Batch[];
  transactions: Transaction[];
  appSettings: AppSettings;
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => void;
  archiveProduct: (productId: string) => void;
  unarchiveProduct: (productId: string) => void;
  getProductById: (id: string) => Product | undefined;
  addBatch: (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => void;
  recordOutflowFromSpecificBatch: (productId: string, batchId: string, quantity: number, reason: OutflowReasonValue, notes?: string) => void;
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
  const [products, setProducts] = useLocalStorage<Product[]>('inventory_products_zh', []);
  const [batches, setBatches] = useLocalStorage<Batch[]>('inventory_batches_zh', []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('inventory_transactions_zh', []);
  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('inventory_app_settings_zh', DEFAULT_APP_SETTINGS);

  const updateAppSettings = (newSettings: Partial<AppSettings>) => {
    setAppSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    toast({ title: "成功", description: "设置已保存。" });
  };

  const addProduct = (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => {
    if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase())) {
      toast({ title: "错误", description: `名为 "${productData.name}" 的产品已存在。`, variant: "destructive" });
      return;
    }
    const newProduct: Product = {
      ...productData,
      id: nanoid(),
      createdAt: formatISO(new Date()),
      isArchived: false,
      imageUrl: productData.imageUrl || undefined,
    };
    setProducts(prev => [...prev, newProduct]);
    toast({ title: "成功", description: `产品 "${newProduct.name}" 已添加。` });
  };

  const archiveProduct = (productId: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: true } : p));
    toast({ title: "成功", description: "产品已归档。" });
  };

  const unarchiveProduct = (productId: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: false } : p));
    toast({ title: "成功", description: "产品已取消归档。" });
  }

  const getProductById = (id: string) => products.find(p => p.id === id);

  const addBatch = (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
    const product = getProductById(batchData.productId);
    if (!product) {
      toast({ title: "错误", description: "未找到此批次的产品。", variant: "destructive" });
      return;
    }
    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      toast({ title: "错误", description: "必须为入库批次提供有效的单位成本。", variant: "destructive"});
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
      productionDateIso = formatISO(parseISO(batchData.productionDate));
      if (product.shelfLifeDays && product.shelfLifeDays > 0) {
        expiryDateIso = formatISO(addDays(parseISO(batchData.productionDate), product.shelfLifeDays));
      }
    } else { 
      productionDateIso = null; 
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
  };

  const recordOutflowFromSpecificBatch = (productId: string, batchId: string, quantityToOutflow: number, reason: OutflowReasonValue, notes?: string) => {
    const product = getProductById(productId);
    if (!product) {
      toast({ title: "错误", description: "未找到产品。", variant: "destructive" });
      return;
    }

    const batchIndex = batches.findIndex(b => b.id === batchId && b.productId === productId);
    if (batchIndex === -1) {
      toast({ title: "错误", description: "未找到指定的批次。", variant: "destructive" });
      return;
    }

    const batch = batches[batchIndex];
    if (quantityToOutflow > 0 && batch.currentQuantity < quantityToOutflow) {
      toast({ title: "错误", description: `所选批次的库存不足。可用: ${batch.currentQuantity}`, variant: "destructive" });
      return;
    }
    
    const updatedBatches = [...batches];
    updatedBatches[batchIndex] = { ...batch, currentQuantity: batch.currentQuantity - quantityToOutflow };
    
    const newTransaction: Transaction = {
      id: nanoid(),
      productId: product.id,
      productName: product.name,
      batchId: batch.id,
      type: 'OUT',
      quantity: Math.abs(quantityToOutflow),
      timestamp: formatISO(new Date()),
      reason,
      notes,
      unitCostAtTransaction: batch.unitCost,
      isCorrectionIncrease: quantityToOutflow < 0 ? true : undefined,
    };

    setBatches(updatedBatches);
    setTransactions(prev => [...prev, newTransaction]);

    if (quantityToOutflow < 0) {
      toast({ title: "成功", description: `为批次 ${batch.id} 的 "${product.name}" 库存更正 ${Math.abs(quantityToOutflow)} ${product.unit}。原因：误操作修正。` });
    } else {
      toast({ title: "成功", description: `从批次 ${batch.id} 中为 "${product.name}" 出库 ${quantityToOutflow} ${product.unit} 已记录。` });
    }
  };


  const getBatchesByProductId = (productId: string) => {
    return batches.filter(b => b.productId === productId);
  };

  const getProductStockDetails = (productId: string) => {
    const productBatches = getBatchesByProductId(productId).filter(b => b.currentQuantity > 0);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    const totalValue = productBatches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return { totalQuantity, totalValue, batches: productBatches };
  };
  
  useEffect(() => {
    const productsExist = typeof window !== 'undefined' && window.localStorage.getItem('inventory_products_zh');
    if (!productsExist) {
      const sampleProductsData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>[] = [
        { name: '阿拉比卡咖啡豆', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365, imageUrl: undefined },
        { name: '全脂牛奶', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, imageUrl: undefined },
        { name: '香草糖浆', category: 'INGREDIENT', unit: '瓶', shelfLifeDays: 730, imageUrl: undefined },
        { name: '马克杯', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null, imageUrl: undefined },
      ];
      
      const createdProducts: Product[] = sampleProductsData.map(p_data => ({
        ...p_data,
        id: nanoid(),
        createdAt: formatISO(addDays(new Date(), -180)), 
        isArchived: false,
      }));
      setProducts(createdProducts);

      const sampleBatchesData = [
        { productId: createdProducts[0].id, productionDateOffset: -30, initialQuantity: 10, currentQuantity: 8, unitCost: 150 },
        { productId: createdProducts[0].id, productionDateOffset: -60, initialQuantity: 5, currentQuantity: 5, unitCost: 145 },
        { productId: createdProducts[1].id, productionDateOffset: -2, initialQuantity: 20, currentQuantity: 15, unitCost: 12 },
        { productId: createdProducts[2].id, productionDateOffset: -90, initialQuantity: 12, currentQuantity: 12, unitCost: 80 },
        { productId: createdProducts[3].id, productionDateOffset: -120, initialQuantity: 50, currentQuantity: 45, unitCost: 25 }, 
      ];

      const createdBatches: Batch[] = [];
      const createdTransactions: Transaction[] = [];

      sampleBatchesData.forEach(b_data => {
        const product = createdProducts.find(p => p.id === b_data.productId);
        if (!product) throw new Error("Sample product not found for batch");
        
        const intakeDate = addDays(new Date(), b_data.productionDateOffset); 
        const batchCreatedAt = formatISO(intakeDate); 

        let productionDateIso: string | null = null;
        let expiryDateIso: string | null = null;

        if (product.category === 'INGREDIENT') {
          productionDateIso = formatISO(intakeDate); 
          if (product.shelfLifeDays) {
            expiryDateIso = formatISO(addDays(intakeDate, product.shelfLifeDays));
          }
        } else { 
          productionDateIso = null; 
          expiryDateIso = null;
        }


        const newBatch: Batch = {
          id: nanoid(),
          productId: b_data.productId,
          productName: product.name,
          productionDate: productionDateIso,
          expiryDate: expiryDateIso,
          initialQuantity: b_data.initialQuantity,
          currentQuantity: b_data.currentQuantity, 
          unitCost: b_data.unitCost,
          createdAt: batchCreatedAt, 
        };
        createdBatches.push(newBatch);

        createdTransactions.push({
          id: nanoid(),
          productId: newBatch.productId,
          productName: newBatch.productName,
          batchId: newBatch.id,
          type: 'IN' as TransactionType,
          quantity: newBatch.initialQuantity,
          timestamp: batchCreatedAt, 
          unitCostAtTransaction: newBatch.unitCost,
          notes: '初始样本数据 - 入库'
        });

        if (b_data.currentQuantity < b_data.initialQuantity) {
          const quantityOut = b_data.initialQuantity - b_data.currentQuantity;
          createdTransactions.push({
            id: nanoid(),
            productId: newBatch.productId,
            productName: newBatch.productName,
            batchId: newBatch.id,
            type: 'OUT' as TransactionType,
            quantity: quantityOut,
            timestamp: formatISO(addDays(intakeDate, Math.floor(Math.abs(b_data.productionDateOffset) / 2) + 1 )), 
            reason: 'SALE' as OutflowReasonValue,
            unitCostAtTransaction: newBatch.unitCost,
            notes: '初始样本数据 - 模拟出库'
          });
        }
      });
      
      setBatches(createdBatches);
      setTransactions(createdTransactions);
      console.log("Sample data initialized with product categories and historical batch createdAt dates.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      appSettings,
      addProduct,
      archiveProduct,
      unarchiveProduct,
      getProductById,
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


"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO } from 'date-fns';

interface InventoryContextType {
  products: Product[];
  batches: Batch[];
  transactions: Transaction[];
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => void;
  archiveProduct: (productId: string) => void;
  unarchiveProduct: (productId: string) => void;
  getProductById: (id: string) => Product | undefined;
  addBatch: (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'>) => void;
  recordOutflow: (productId: string, quantity: number, reason: OutflowReasonValue, notes?: string) => void;
  getBatchesByProductId: (productId: string) => Batch[];
  getProductStockDetails: (productId: string) => { totalQuantity: number; batches: Batch[] };
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

  const addBatch = (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'>) => {
    const product = getProductById(batchData.productId);
    if (!product) {
      toast({ title: "错误", description: "未找到此批次的产品。", variant: "destructive" });
      return;
    }

    const productionDate = new Date(batchData.productionDate);
    const expiryDate = addDays(productionDate, product.shelfLifeDays);

    const newBatch: Batch = {
      ...batchData,
      id: nanoid(),
      productName: product.name,
      expiryDate: formatISO(expiryDate),
      productionDate: formatISO(productionDate), 
      currentQuantity: batchData.initialQuantity,
      createdAt: formatISO(new Date()),
    };
    setBatches(prev => [...prev, newBatch]);

    const newTransaction: Transaction = {
      id: nanoid(),
      productId: newBatch.productId,
      productName: product.name,
      batchId: newBatch.id,
      type: 'IN',
      quantity: newBatch.initialQuantity,
      timestamp: formatISO(new Date()),
      unitCostAtTransaction: newBatch.unitCost,
      notes: `批次 ${newBatch.id} 的初始入库`,
    };
    setTransactions(prev => [...prev, newTransaction]);
    toast({ title: "成功", description: `"${product.name}" 的批次已添加。数量: ${newBatch.initialQuantity}` });
  };

  const recordOutflow = (productId: string, quantityToOutflow: number, reason: OutflowReasonValue, notes?: string) => {
    const product = getProductById(productId);
    if (!product) {
      toast({ title: "错误", description: "未找到产品。", variant: "destructive" });
      return;
    }

    let remainingQuantityToOutflow = quantityToOutflow;
    const productBatches = batches
      .filter(b => b.productId === productId && b.currentQuantity > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()); 

    if (productBatches.reduce((sum, b) => sum + b.currentQuantity, 0) < quantityToOutflow) {
      toast({ title: "错误", description: `"${product.name}" 库存不足。可用: ${productBatches.reduce((sum, b) => sum + b.currentQuantity, 0)}`, variant: "destructive" });
      return;
    }

    const updatedBatches = [...batches];
    const newTransactions: Transaction[] = [];

    for (const batch of productBatches) {
      if (remainingQuantityToOutflow <= 0) break;

      const batchIndex = updatedBatches.findIndex(b => b.id === batch.id);
      if (batchIndex === -1) continue;

      const outflowFromThisBatch = Math.min(batch.currentQuantity, remainingQuantityToOutflow);
      updatedBatches[batchIndex] = { ...batch, currentQuantity: batch.currentQuantity - outflowFromThisBatch };
      
      newTransactions.push({
        id: nanoid(),
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        type: 'OUT',
        quantity: outflowFromThisBatch,
        timestamp: formatISO(new Date()),
        reason,
        notes,
        unitCostAtTransaction: batch.unitCost,
      });
      remainingQuantityToOutflow -= outflowFromThisBatch;
    }

    setBatches(updatedBatches);
    setTransactions(prev => [...prev, ...newTransactions]);
    toast({ title: "成功", description: `"${product.name}" 的 ${quantityToOutflow} 件库存出库已记录。` });
  };

  const getBatchesByProductId = (productId: string) => {
    return batches.filter(b => b.productId === productId);
  };

  const getProductStockDetails = (productId: string) => {
    const productBatches = getBatchesByProductId(productId).filter(b => b.currentQuantity > 0);
    const totalQuantity = productBatches.reduce((sum, batch) => sum + batch.currentQuantity, 0);
    return { totalQuantity, batches: productBatches };
  };
  
  useEffect(() => {
    if (products.length === 0 && batches.length === 0) {
      const sampleProducts = [
        { id: 'coffee-beans-arabica', name: '阿拉比卡咖啡豆', category: '咖啡', unit: 'kg', shelfLifeDays: 365, createdAt: formatISO(new Date()), isArchived: false },
        { id: 'milk-full-cream', name: '全脂牛奶', category: '乳制品', unit: '升', shelfLifeDays: 7, createdAt: formatISO(new Date()), isArchived: false },
        { id: 'syrup-vanilla', name: '香草糖浆', category: '糖浆', unit: '瓶', shelfLifeDays: 730, createdAt: formatISO(new Date()), isArchived: false },
      ];
      setProducts(sampleProducts);

      const sampleBatches = [
        { id: nanoid(), productId: 'coffee-beans-arabica', productName: '阿拉比卡咖啡豆', productionDate: formatISO(addDays(new Date(), -30)), expiryDate: formatISO(addDays(new Date(), 335)), initialQuantity: 10, currentQuantity: 8, unitCost: 15, createdAt: formatISO(new Date()) },
        { id: nanoid(), productId: 'coffee-beans-arabica', productName: '阿拉比卡咖啡豆', productionDate: formatISO(addDays(new Date(), -60)), expiryDate: formatISO(addDays(new Date(), 305)), initialQuantity: 5, currentQuantity: 5, unitCost: 14.5, createdAt: formatISO(new Date()) },
        { id: nanoid(), productId: 'milk-full-cream', productName: '全脂牛奶', productionDate: formatISO(addDays(new Date(), -2)), expiryDate: formatISO(addDays(new Date(), 5)), initialQuantity: 20, currentQuantity: 15, unitCost: 1.2, createdAt: formatISO(new Date()) },
      ];
      setBatches(sampleBatches);
      
      const sampleTransactions: Transaction[] = sampleBatches.map(b => ({
        id: nanoid(),
        productId: b.productId,
        productName: b.productName,
        batchId: b.id,
        type: 'IN' as TransactionType,
        quantity: b.initialQuantity,
        timestamp: b.createdAt,
        unitCostAtTransaction: b.unitCost,
        notes: '初始样本数据'
      }));
      if (sampleBatches[0]) {
        sampleTransactions.push({
          id: nanoid(),
          productId: sampleBatches[0].productId,
          productName: sampleBatches[0].productName,
          batchId: sampleBatches[0].id,
          type: 'OUT' as TransactionType,
          quantity: 2, 
          timestamp: formatISO(addDays(new Date(), -1)),
          reason: 'SALE' as OutflowReasonValue,
          unitCostAtTransaction: sampleBatches[0].unitCost,
          notes: '示例销售'
        });
      }
      setTransactions(sampleTransactions);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <InventoryContext.Provider value={{
      products,
      batches,
      transactions,
      addProduct,
      archiveProduct,
      unarchiveProduct,
      getProductById,
      addBatch,
      recordOutflow,
      getBatchesByProductId,
      getProductStockDetails
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


"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO, parseISO } from 'date-fns';

interface InventoryContextType {
  products: Product[];
  batches: Batch[];
  transactions: Transaction[];
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => void;
  archiveProduct: (productId: string) => void;
  unarchiveProduct: (productId: string) => void;
  getProductById: (id: string) => Product | undefined;
  addBatch: (batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'>) => void;
  recordOutflowFromSpecificBatch: (productId: string, batchId: string, quantity: number, reason: OutflowReasonValue, notes?: string) => void;
  getBatchesByProductId: (productId: string) => Batch[];
  getProductStockDetails: (productId: string) => { totalQuantity: number; totalValue: number; batches: Batch[] };
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
    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      toast({ title: "错误", description: "必须为入库批次提供有效的单位成本。", variant: "destructive"});
      return;
    }

    const productionDate = new Date(batchData.productionDate);
    const expiryDate = addDays(productionDate, product.shelfLifeDays);
    const batchCreatedAt = formatISO(new Date()); 

    const newBatch: Batch = {
      ...batchData,
      id: nanoid(),
      productName: product.name,
      expiryDate: formatISO(expiryDate),
      productionDate: formatISO(productionDate), 
      currentQuantity: batchData.initialQuantity,
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
    toast({ title: "成功", description: `"${product.name}" 的批次已添加。数量: ${newBatch.initialQuantity}，单位成本: ${newBatch.unitCost.toFixed(2)}` });
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
    if (batch.currentQuantity < quantityToOutflow) {
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
      quantity: quantityToOutflow,
      timestamp: formatISO(new Date()),
      reason,
      notes,
      unitCostAtTransaction: batch.unitCost,
    };

    setBatches(updatedBatches);
    setTransactions(prev => [...prev, newTransaction]);
    toast({ title: "成功", description: `从批次 ${batch.id} 中为 "${product.name}" 出库 ${quantityToOutflow} 件已记录。` });
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
    const batchesExist = typeof window !== 'undefined' && window.localStorage.getItem('inventory_batches_zh');
    const transactionsExist = typeof window !== 'undefined' && window.localStorage.getItem('inventory_transactions_zh');

    if (!productsExist && !batchesExist && !transactionsExist) {
      const sampleProductsData = [
        { name: '阿拉比卡咖啡豆', category: '咖啡', unit: 'kg', shelfLifeDays: 365 },
        { name: '全脂牛奶', category: '乳制品', unit: '升', shelfLifeDays: 7 },
        { name: '香草糖浆', category: '糖浆', unit: '瓶', shelfLifeDays: 730 },
      ];
      
      const createdProducts: Product[] = sampleProductsData.map(p => ({
        ...p,
        id: nanoid(),
        createdAt: formatISO(addDays(new Date(), -180)), 
        isArchived: false,
      }));
      setProducts(createdProducts);

      const sampleBatchesData = [
        { productId: createdProducts[0].id, productName: createdProducts[0].name, productionDateOffset: -30, initialQuantity: 10, currentQuantity: 8, unitCost: 15 },
        { productId: createdProducts[0].id, productName: createdProducts[0].name, productionDateOffset: -60, initialQuantity: 5, currentQuantity: 5, unitCost: 14.5 },
        { productId: createdProducts[1].id, productName: createdProducts[1].name, productionDateOffset: -2, initialQuantity: 20, currentQuantity: 15, unitCost: 1.2 },
        { productId: createdProducts[2].id, productName: createdProducts[2].name, productionDateOffset: -90, initialQuantity: 12, currentQuantity: 12, unitCost: 8.0 },
      ];

      const createdBatches: Batch[] = [];
      const createdTransactions: Transaction[] = [];

      sampleBatchesData.forEach(b_data => {
        const product = createdProducts.find(p => p.id === b_data.productId);
        if (!product) throw new Error("Sample product not found for batch");
        
        const productionDate = addDays(new Date(), b_data.productionDateOffset);
        const batchCreatedAt = formatISO(productionDate); 

        const newBatch: Batch = {
          id: nanoid(),
          productId: b_data.productId,
          productName: b_data.productName,
          productionDate: formatISO(productionDate),
          expiryDate: formatISO(addDays(productionDate, product.shelfLifeDays)),
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
            timestamp: formatISO(addDays(productionDate, Math.floor(Math.abs(b_data.productionDateOffset) / 2) + 1 )), 
            reason: 'SALE' as OutflowReasonValue,
            unitCostAtTransaction: newBatch.unitCost,
            notes: '初始样本数据 - 模拟出库'
          });
        }
      });
      
      setBatches(createdBatches);
      setTransactions(createdTransactions);
      console.log("Sample data initialized with historical batch createdAt dates.");
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
      recordOutflowFromSpecificBatch,
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


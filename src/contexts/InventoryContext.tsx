
"use client";

import type { Product, Batch, Transaction, OutflowReasonValue, TransactionType, ProductCategory, AppSettings } from '@/lib/types';
import { nanoid } from 'nanoid';
import React, { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { toast } from "@/hooks/use-toast";
import { addDays, formatISO, parseISO, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval } from 'date-fns'; // Added date-fns functions

const DEFAULT_APP_SETTINGS: AppSettings = {
  expiryWarningDays: 7,
};

interface InventoryContextType {
  products: Product[];
  batches: Batch[];
  transactions: Transaction[];
  appSettings: AppSettings;
  addProduct: (productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => void;
  editProduct: (productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => void;
  archiveProduct: (productId: string) => void;
  unarchiveProduct: (productId: string) => void;
  getProductById: (id: string) => Product | undefined;
  getMostRecentUnitCost: (productId: string) => number | undefined;
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
  const [products, setProducts] = useLocalStorage<Product[]>('inventory_products_zh_v2', []);
  const [batches, setBatches] = useLocalStorage<Batch[]>('inventory_batches_zh_v2', []);
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>('inventory_transactions_zh_v2', []);
  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('inventory_app_settings_zh_v2', DEFAULT_APP_SETTINGS);

  const updateAppSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setAppSettings(prevSettings => ({ ...prevSettings, ...newSettings }));
    toast({ title: "成功", description: "设置已保存。" });
  }, [setAppSettings]);

  const addProduct = useCallback((productData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>) => {
    if (products.some(p => p.name.toLowerCase() === productData.name.toLowerCase() && !p.isArchived)) {
      toast({ title: "错误", description: `名为 "${productData.name}" 的活动产品已存在。`, variant: "destructive" });
      return;
    }
    const newProduct: Product = {
      ...productData,
      id: nanoid(),
      createdAt: formatISO(new Date()),
      isArchived: false,
      imageUrl: productData.imageUrl || undefined,
      lowStockThreshold: productData.lowStockThreshold,
    };
    setProducts(prev => [...prev, newProduct]);
    toast({ title: "成功", description: `产品 "${newProduct.name}" 已添加。` });
  }, [products, setProducts]);

  const editProduct = useCallback((productId: string, updatedProductData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>) => {
    setProducts(prevProducts =>
      prevProducts.map(p => {
        if (p.id === productId) {
          if (updatedProductData.name && updatedProductData.name !== p.name && prevProducts.some(op => op.id !== productId && op.name.toLowerCase() === updatedProductData.name!.toLowerCase() && !op.isArchived)) {
            toast({ title: "错误", description: `名为 "${updatedProductData.name}" 的另一个活动产品已存在。`, variant: "destructive" });
            return p; 
          }
          const updatedProduct = { ...p, ...updatedProductData };
           toast({ title: "成功", description: `产品 "${updatedProduct.name}" 已更新。` });
          return updatedProduct;
        }
        return p;
      })
    );
  }, [setProducts]);

  const archiveProduct = useCallback((productId: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: true } : p));
    toast({ title: "成功", description: "产品已归档。" });
  }, [setProducts]);

  const unarchiveProduct = useCallback((productId: string) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, isArchived: false } : p));
    toast({ title: "成功", description: "产品已取消归档。" });
  }, [setProducts]);

  const getProductById = useCallback((id: string) => {
    return products.find(p => p.id === id);
  }, [products]);

  const getMostRecentUnitCost = useCallback((productId: string): number | undefined => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
    return productBatches.length > 0 ? productBatches[0].unitCost : undefined;
  }, [batches]);

  const addBatch = useCallback((batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null }) => {
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
      productionDateIso = batchData.productionDate ? formatISO(parseISO(batchData.productionDate)) : formatISO(new Date());
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
  }, [getProductById, setBatches, setTransactions]);

  const recordOutflowFromSpecificBatch = useCallback((productId: string, batchId: string, quantityToOutflow: number, reason: OutflowReasonValue, notes?: string) => {
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
    } else if (quantityToOutflow < 0) { // Correction increase for a potentially depleted/non-existent batch id
        // Try to find *any* batch of this product to get a unit cost, or last transaction cost
        const productBatches = batches.filter(b => b.productId === productId).sort((a,b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime());
        if (productBatches.length > 0) {
            actualUnitCostAtTransaction = productBatches[0].unitCost;
        } else {
            const lastProductTransaction = transactions.filter(t => t.productId === productId && t.unitCostAtTransaction !== undefined).sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
            if (lastProductTransaction.length > 0) {
                 actualUnitCostAtTransaction = lastProductTransaction[0].unitCostAtTransaction;
            }
        }
        // If still no cost, it will be undefined. This situation is less ideal for value tracking.
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
  }, [batches, getProductById, setBatches, setTransactions, transactions]);


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
    const productsExist = typeof window !== 'undefined' && window.localStorage.getItem('inventory_products_zh_v2');
    if (!productsExist) {
      console.log("Initializing sample data v2.1 for inventory analysis...");
      const sampleProductsData: Omit<Product, 'id' | 'createdAt' | 'isArchived'>[] = [
        { name: '阿拉比卡咖啡豆', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365, lowStockThreshold: 2, imageUrl: 'https://placehold.co/300x300.png?text=豆', },
        { name: '全脂牛奶', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, lowStockThreshold: 3, imageUrl: 'https://placehold.co/300x300.png?text=奶' },
        { name: '香草糖浆', category: 'INGREDIENT', unit: '瓶', shelfLifeDays: 730, lowStockThreshold: 1, imageUrl: 'https://placehold.co/300x300.png?text=浆' },
        { name: '马克杯', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null, lowStockThreshold: 5, imageUrl: 'https://placehold.co/300x300.png?text=杯' },
      ];
      
      const createdProducts: Product[] = sampleProductsData.map((p_data, index) => ({
        ...p_data,
        id: `sample_prod_${index + 1}`,
        createdAt: formatISO(addDays(new Date(), -180)), 
        isArchived: false,
      }));
      setProducts(createdProducts);

      let tempBatches: Batch[] = [];
      let tempTransactions: Transaction[] = [];
      
      const today = new Date();
      const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 });
      const startOfLastWeek = subWeeks(startOfThisWeek, 1);
      const endOfLastWeek = endOfWeek(startOfLastWeek, { weekStartsOn: 1 });
      const daysInLastWeek = eachDayOfInterval({ start: startOfLastWeek, end: endOfLastWeek });

      // Sample Batches (Initial Stock before last week's consumption)
      // Product 1: 阿拉比卡咖啡豆 (Coffee Beans) - Moderate Stock, Moderate Consumption
      const coffeeProdDate = addDays(today, -60);
      const coffeeBatch: Batch = {
        id: 'sample_batch_coffee_1', productId: createdProducts[0].id, productName: createdProducts[0].name,
        productionDate: formatISO(coffeeProdDate), expiryDate: formatISO(addDays(coffeeProdDate, createdProducts[0].shelfLifeDays!)),
        initialQuantity: 10, currentQuantity: 10, unitCost: 150, createdAt: formatISO(coffeeProdDate)
      };
      tempBatches.push(coffeeBatch);
      tempTransactions.push({
        id: nanoid(), productId: coffeeBatch.productId, productName: coffeeBatch.productName, batchId: coffeeBatch.id, type: 'IN',
        quantity: coffeeBatch.initialQuantity, timestamp: coffeeBatch.createdAt, unitCostAtTransaction: coffeeBatch.unitCost, notes: '初始样本数据 - 入库'
      });

      // Product 2: 全脂牛奶 (Milk) - Low Stock, High Consumption (should deplete soonest)
      const milkProdDate = addDays(today, -10); // More recent production
      const milkBatch: Batch = {
        id: 'sample_batch_milk_1', productId: createdProducts[1].id, productName: createdProducts[1].name,
        productionDate: formatISO(milkProdDate), expiryDate: formatISO(addDays(milkProdDate, createdProducts[1].shelfLifeDays!)),
        initialQuantity: 5, currentQuantity: 5, unitCost: 12, createdAt: formatISO(milkProdDate)
      };
      tempBatches.push(milkBatch);
      tempTransactions.push({
        id: nanoid(), productId: milkBatch.productId, productName: milkBatch.productName, batchId: milkBatch.id, type: 'IN',
        quantity: milkBatch.initialQuantity, timestamp: milkBatch.createdAt, unitCostAtTransaction: milkBatch.unitCost, notes: '初始样本数据 - 入库'
      });
      
      // Product 3: 香草糖浆 (Syrup) - High Stock, Low Consumption
      const syrupProdDate = addDays(today, -90);
      const syrupBatch: Batch = {
        id: 'sample_batch_syrup_1', productId: createdProducts[2].id, productName: createdProducts[2].name,
        productionDate: formatISO(syrupProdDate), expiryDate: formatISO(addDays(syrupProdDate, createdProducts[2].shelfLifeDays!)),
        initialQuantity: 20, currentQuantity: 20, unitCost: 80, createdAt: formatISO(syrupProdDate)
      };
      tempBatches.push(syrupBatch);
      tempTransactions.push({
        id: nanoid(), productId: syrupBatch.productId, productName: syrupBatch.productName, batchId: syrupBatch.id, type: 'IN',
        quantity: syrupBatch.initialQuantity, timestamp: syrupBatch.createdAt, unitCostAtTransaction: syrupBatch.unitCost, notes: '初始样本数据 - 入库'
      });

      // Product 4: 马克杯 (Mug) - Non-ingredient, some consumption
      const mugProdDate = addDays(today, -120);
      const mugBatch: Batch = {
        id: 'sample_batch_mug_1', productId: createdProducts[3].id, productName: createdProducts[3].name,
        productionDate: formatISO(mugProdDate), expiryDate: null,
        initialQuantity: 30, currentQuantity: 30, unitCost: 25, createdAt: formatISO(mugProdDate)
      };
      tempBatches.push(mugBatch);
      tempTransactions.push({
        id: nanoid(), productId: mugBatch.productId, productName: mugBatch.productName, batchId: mugBatch.id, type: 'IN',
        quantity: mugBatch.initialQuantity, timestamp: mugBatch.createdAt, unitCostAtTransaction: mugBatch.unitCost, notes: '初始样本数据 - 入库'
      });


      // Simulate 'OUT' transactions for *last week*
      // Milk: High consumption (e.g., 0.5L per day for 5 days last week)
      for (let i = 0; i < 5; i++) { // 5 days of consumption
        if (milkBatch.currentQuantity >= 0.5) {
          const transactionDate = formatISO(daysInLastWeek[i]);
          tempTransactions.push({
            id: nanoid(), productId: milkBatch.productId, productName: milkBatch.productName, batchId: milkBatch.id, type: 'OUT',
            quantity: 0.5, timestamp: transactionDate, unitCostAtTransaction: milkBatch.unitCost, reason: 'SALE', notes: '样本销售'
          });
          milkBatch.currentQuantity -= 0.5;
        }
      }
      
      // Coffee: Moderate consumption (e.g., 0.2kg per day for 3 days last week)
      for (let i = 0; i < 3; i++) {
        if (coffeeBatch.currentQuantity >= 0.2) {
          const transactionDate = formatISO(daysInLastWeek[i]);
           tempTransactions.push({
            id: nanoid(), productId: coffeeBatch.productId, productName: coffeeBatch.productName, batchId: coffeeBatch.id, type: 'OUT',
            quantity: 0.2, timestamp: transactionDate, unitCostAtTransaction: coffeeBatch.unitCost, reason: 'SALE', notes: '样本销售'
          });
          coffeeBatch.currentQuantity -= 0.2;
        }
      }
      
      // Syrup: Low consumption (e.g., 1 bottle total last week)
      if (syrupBatch.currentQuantity >= 1) {
        const transactionDate = formatISO(daysInLastWeek[2]); // One day last week
        tempTransactions.push({
            id: nanoid(), productId: syrupBatch.productId, productName: syrupBatch.productName, batchId: syrupBatch.id, type: 'OUT',
            quantity: 1, timestamp: transactionDate, unitCostAtTransaction: syrupBatch.unitCost, reason: 'SALE', notes: '样本销售'
        });
        syrupBatch.currentQuantity -= 1;
      }

      // Mug: Some consumption (e.g., 2 mugs total last week)
      if (mugBatch.currentQuantity >= 2) {
        const transactionDate = formatISO(daysInLastWeek[3]);
        tempTransactions.push({
            id: nanoid(), productId: mugBatch.productId, productName: mugBatch.productName, batchId: mugBatch.id, type: 'OUT',
            quantity: 2, timestamp: transactionDate, unitCostAtTransaction: mugBatch.unitCost, reason: 'SALE', notes: '样本销售'
        });
        mugBatch.currentQuantity -= 2;
      }

      // Update batch currentQuantities based on simulated outflows
      const finalBatches = tempBatches.map(b => {
          if (b.id === coffeeBatch.id) return coffeeBatch;
          if (b.id === milkBatch.id) return milkBatch;
          if (b.id === syrupBatch.id) return syrupBatch;
          if (b.id === mugBatch.id) return mugBatch;
          return b;
      });
      
      setBatches(finalBatches);
      setTransactions(tempTransactions);
      console.log("Sample data v2.1 initialized with targeted 'last week' consumptions.");
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

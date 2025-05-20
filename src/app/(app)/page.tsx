
"use client";

import { useState, useEffect } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { ProductSummaryCard } from "@/components/cards/ProductSummaryCard";
import { AlertTriangle, PackageSearch, Warehouse, Package, Loader2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { subDays, parseISO, isWithinInterval, endOfDay } from "date-fns";
import type { Transaction } from "@/lib/types";

export default function DashboardPage() {
  const { products, getProductStockDetails, archiveProduct, transactions } = useInventory();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Warehouse className="h-8 w-8" /> 库存仪表盘</h1>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-2/5" /> {/* Skeleton for title */}
                <Skeleton className="h-4 w-4 rounded-sm" /> {/* Skeleton for icon */}
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/3 mb-1" /> {/* Skeleton for value */}
                <Skeleton className="h-4 w-3/4" /> {/* Skeleton for description */}
              </CardContent>
            </Card>
          ))}
        </div>
        
        <h2 className="text-2xl font-semibold">产品库存水平</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => ( // Show 3 skeleton product cards
            <Card key={i} className="flex flex-col h-full">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-6 w-3/5 mb-1" /> {/* Product Name */}
                    <Skeleton className="h-4 w-4/5" /> {/* Category */}
                  </div>
                  <Skeleton className="h-6 w-6 rounded-sm" /> {/* Icon Placeholder */}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="h-12 w-12 rounded-md" /> {/* Image */}
                  <div>
                    <Skeleton className="h-7 w-16 mb-1" /> {/* Quantity */}
                    <Skeleton className="h-4 w-20" /> {/* Label */}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow pt-0 pb-2">
                 <div className="h-48 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                 </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Skeleton className="h-5 w-20" /> {/* Badge */}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const activeProducts = products.filter(p => !p.isArchived);

  const today = endOfDay(new Date());
  const sevenDaysAgo = subDays(today, 7);

  const last7DaysOutflowValue = transactions.reduce((totalValue, transaction) => {
    if (
      transaction.type === 'OUT' &&
      !transaction.isCorrectionIncrease && // Exclude corrections that added stock back
      transaction.unitCostAtTransaction !== undefined &&
      isWithinInterval(parseISO(transaction.timestamp), { start: sevenDaysAgo, end: today })
    ) {
      return totalValue + (transaction.quantity * transaction.unitCostAtTransaction);
    }
    return totalValue;
  }, 0);


  const itemsNearingExpiry = activeProducts.flatMap(p => {
    const { batches } = getProductStockDetails(p.id);
    return batches.filter(b => {
      if (!b.expiryDate) return false; 
      const daysLeft = (new Date(b.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return daysLeft >= 0 && daysLeft <= 7;
    });
  }).length;

  const lowStockItems = activeProducts.filter(p => {
    const { totalQuantity } = getProductStockDetails(p.id);
    return totalQuantity < 5; 
  }).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2"><Warehouse className="h-8 w-8" /> 库存仪表盘</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">产品总数</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProducts.length}</div>
            <p className="text-xs text-muted-foreground">活动产品</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">过去7天出库总价值</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{last7DaysOutflowValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">过去7天出库产品价值总和</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">提醒</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems + itemsNearingExpiry}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockItems} 项低库存, {itemsNearingExpiry} 项临近过期
            </p>
          </CardContent>
        </Card>
      </div>
      
      <h2 className="text-2xl font-semibold">产品库存水平</h2>
      {activeProducts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {activeProducts.map((product) => {
            const { totalQuantity, batches } = getProductStockDetails(product.id);
            return (
              <ProductSummaryCard
                key={product.id}
                product={product}
                batches={batches}
                totalQuantity={totalQuantity}
                onArchiveProduct={archiveProduct}
              />
            );
          })}
        </div>
      ) : (
        <Card className="col-span-full">
          <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[200px] text-center">
            <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold">未找到产品</h3>
            <p className="text-muted-foreground mb-4">
              请先添加您的第一个产品以管理库存。
            </p>
            <Button asChild>
              <Link href="/products/add">添加新产品</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

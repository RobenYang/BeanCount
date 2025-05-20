
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import { ProductSummaryCard } from "@/components/cards/ProductSummaryCard";
import { AlertTriangle, PackageSearch, Warehouse, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardPage() {
  const { products, getProductStockDetails, archiveProduct } = useInventory();
  const activeProducts = products.filter(p => !p.isArchived);

  const totalStockValue = activeProducts.reduce((totalValue, product) => {
    const { batches } = getProductStockDetails(product.id);
    const productValue = batches.reduce((sum, batch) => sum + (batch.currentQuantity * batch.unitCost), 0);
    return totalValue + productValue;
  }, 0);

  const itemsNearingExpiry = activeProducts.flatMap(p => {
    const { batches } = getProductStockDetails(p.id);
    return batches.filter(b => {
      const daysLeft = (new Date(b.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return daysLeft >= 0 && daysLeft <= 7;
    });
  }).length;

  const lowStockItems = activeProducts.filter(p => {
    const { totalQuantity } = getProductStockDetails(p.id);
    return totalQuantity < 5; // Example threshold
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
            <CardTitle className="text-sm font-medium">总库存价值</CardTitle>
            <span className="h-4 w-4 text-muted-foreground font-bold text-lg">$</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStockValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">当前库存估值</p>
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

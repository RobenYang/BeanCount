
"use client";

import { useState, useEffect } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import { ProductSummaryCard } from "@/components/cards/ProductSummaryCard";
import { AlertTriangle, PackageSearch, Warehouse, TrendingUp, Loader2, CircleDollarSign, Package as PackageIcon, Smile } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { subDays, parseISO, isWithinInterval, endOfDay, differenceInDays, format } from "date-fns";
import type { Transaction, Product, Batch } from "@/lib/types";
import { zhCN } from 'date-fns/locale';

interface LowStockProductDetail {
  id: string;
  name: string;
  currentQuantity: number;
  unit: string;
  threshold: number; // Product-specific threshold
}

interface NearingExpiryProductDetail {
  productId: string;
  productName: string;
  productUnit: string;
  batchId: string;
  expiryDate: string;
  daysLeft: number;
  currentQuantity: number;
  warningDays: number; // Global expiry warning days from appSettings
}


export default function DashboardPage() {
  const { products, getProductStockDetails, archiveProduct, transactions, appSettings } = useInventory();
  const [hasMounted, setHasMounted] = useState(false);
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [currentDateDisplay, setCurrentDateDisplay] = useState("...");
  const [currentDayDisplay, setCurrentDayDisplay] = useState("...");


  useEffect(() => {
    setHasMounted(true);
    const today = new Date();
    setCurrentDateDisplay(format(today, "M月d日", { locale: zhCN }));
    setCurrentDayDisplay(format(today, "EEEE", { locale: zhCN }));
  }, []);

  const activeProducts = products.filter(p => !p.isArchived);

  const today = endOfDay(new Date());
  const sevenDaysAgo = subDays(today, 7);

  const last7DaysOutflowValue = transactions.reduce((totalValue, transaction) => {
    if (
      transaction.type === 'OUT' &&
      !transaction.isCorrectionIncrease &&
      transaction.unitCostAtTransaction !== undefined &&
      transaction.unitCostAtTransaction !== null && // Ensure unitCostAtTransaction is not null
      isWithinInterval(parseISO(transaction.timestamp), { start: sevenDaysAgo, end: today })
    ) {
      return totalValue + (transaction.quantity * transaction.unitCostAtTransaction);
    }
    return totalValue;
  }, 0);

  const currentTotalStockValue = activeProducts.reduce((total, product) => {
    const { totalValue } = getProductStockDetails(product.id);
    return total + totalValue;
  }, 0);

  const lowStockProductsDetails: LowStockProductDetail[] = activeProducts
    .map(p => {
      const { totalQuantity } = getProductStockDetails(p.id);
      return { product: p, totalQuantity };
    })
    .filter(({ product, totalQuantity }) => totalQuantity < product.lowStockThreshold) // Use product.lowStockThreshold
    .map(({ product, totalQuantity }) => ({
      id: product.id,
      name: product.name,
      currentQuantity: totalQuantity,
      unit: product.unit,
      threshold: product.lowStockThreshold, // Use product.lowStockThreshold
    }));

  const nearingExpiryProductsDetails: NearingExpiryProductDetail[] = activeProducts.flatMap(p => {
    if (p.category !== 'INGREDIENT') return [];
    const { batches } = getProductStockDetails(p.id);
    return batches
      .filter(b => {
        if (!b.expiryDate) return false;
        const daysLeft = differenceInDays(parseISO(b.expiryDate), new Date());
        return daysLeft >= 0 && daysLeft <= appSettings.expiryWarningDays; // appSettings for expiry warning
      })
      .map(b => ({
        productId: p.id,
        productName: p.name,
        productUnit: p.unit,
        batchId: b.id,
        expiryDate: format(parseISO(b.expiryDate), "yyyy-MM-dd", { locale: zhCN }),
        daysLeft: differenceInDays(parseISO(b.expiryDate), new Date()),
        currentQuantity: b.currentQuantity,
        warningDays: appSettings.expiryWarningDays,
      }));
  });

  const lowStockItemsCount = lowStockProductsDetails.length;
  const itemsNearingExpiryCount = nearingExpiryProductsDetails.length;


  if (!hasMounted) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center text-lg font-medium text-muted-foreground">
            <Smile className="h-6 w-6 mr-2 text-primary" />
            <span>正在加载日期...</span>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Warehouse className="h-8 w-8" /> 库存仪表盘</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-4 rounded-sm" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-1/3 mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className="text-2xl font-semibold">产品概览</h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="flex flex-col h-full">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <Skeleton className="h-6 w-3/5 mb-1" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                  <Skeleton className="h-6 w-6 rounded-sm" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div>
                    <Skeleton className="h-7 w-16 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-grow pt-0 pb-2">
                 <div className="h-12 flex items-center justify-center"> 
                    {/* Adjusted height as batch table is removed */}
                 </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Skeleton className="h-5 w-20" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center text-lg font-medium text-muted-foreground">
        <Smile className="h-6 w-6 mr-2 text-primary" />
        今天是 {currentDateDisplay}，{currentDayDisplay}。
      </div>
      <h1 className="text-3xl font-bold flex items-center gap-2"><Warehouse className="h-8 w-8" /> 库存仪表盘</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">产品总数</CardTitle>
            <PackageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProducts.length}</div>
            <p className="text-xs text-muted-foreground">活动产品</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总库存价值</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{currentTotalStockValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">当前所有活动产品的价值总和</p>
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
        <Card
          onClick={() => setIsAlertsModalOpen(true)}
          className="cursor-pointer hover:shadow-lg transition-shadow"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsAlertsModalOpen(true)}
          aria-label="查看预警详情"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">提醒</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItemsCount + itemsNearingExpiryCount}</div>
            <p className="text-xs text-muted-foreground">
              {lowStockItemsCount} 项低库存, {itemsNearingExpiryCount} 项临近过期
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-semibold">产品概览</h2>
      {activeProducts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {activeProducts.map((product) => {
            const { totalQuantity, batches } = getProductStockDetails(product.id);
            return (
              <ProductSummaryCard
                key={product.id}
                product={product}
                batches={batches} // batches prop is still needed for expiry badge logic
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

      <Dialog open={isAlertsModalOpen} onOpenChange={setIsAlertsModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>预警产品详情</DialogTitle>
            <DialogDescription>
              以下是需要您关注的低库存和临近过期的产品。
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">低库存产品 ({lowStockProductsDetails.length})</h3>
                {lowStockProductsDetails.length > 0 ? (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>产品名称</TableHead>
                          <TableHead className="text-right">当前数量</TableHead>
                          <TableHead className="text-right">预警阈值</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockProductsDetails.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right">{item.currentQuantity} {item.unit}</TableCell>
                            <TableCell className="text-right">{item.threshold} {item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无低库存产品。</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">临近过期产品 ({nearingExpiryProductsDetails.length})</h3>
                {nearingExpiryProductsDetails.length > 0 ? (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>产品名称</TableHead>
                          <TableHead>过期日期</TableHead>
                          <TableHead className="text-right">剩余天数</TableHead>
                          <TableHead className="text-right">批次数量</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {nearingExpiryProductsDetails.map(item => (
                          <TableRow key={`${item.productId}-${item.batchId}`}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell>{item.expiryDate}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={item.daysLeft <= 0 ? "destructive" : "outline"}>
                                {item.daysLeft < 0 ? `已过期 ${Math.abs(item.daysLeft)}天` : `${item.daysLeft}天`}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{item.currentQuantity} {item.productUnit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无临近过期产品。</p>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">关闭</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


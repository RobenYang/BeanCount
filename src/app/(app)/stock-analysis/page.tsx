
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { ProductStockAnalysis } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, PackageSearch, Info } from "lucide-react";
import { format, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isWithinInterval, addDays, differenceInDays } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { useMemo, useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function getPreviousFullWeekRange(): { start: Date; end: Date } {
  const today = new Date();
  const startOfThisWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday as start of the week
  const startOfLastWeek = subWeeks(startOfThisWeek, 1);
  const endOfLastWeek = endOfWeek(startOfLastWeek, { weekStartsOn: 1 });
  return { start: startOfLastWeek, end: endOfLastWeek };
}

export default function StockAnalysisPage() {
  const { products, transactions, getProductStockDetails } = useInventory();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const analysisData: ProductStockAnalysis[] = useMemo(() => {
    if (!hasMounted) return [];

    const activeProducts = products.filter(p => !p.isArchived);
    if (activeProducts.length === 0) return [];

    const { start: lastWeekStart, end: lastWeekEnd } = getPreviousFullWeekRange();

    return activeProducts.map(product => {
      const { totalQuantity: currentStock, batches } = getProductStockDetails(product.id);

      const transactionsLastWeek = transactions.filter(t =>
        t.productId === product.id &&
        t.type === 'OUT' &&
        !t.isCorrectionIncrease &&
        isWithinInterval(parseISO(t.timestamp), { start: lastWeekStart, end: lastWeekEnd })
      );

      const totalConsumedLastWeek = transactionsLastWeek.reduce((sum, t) => sum + t.quantity, 0);
      const avgDailyConsumptionLastWeek = totalConsumedLastWeek / 7;

      let predictedDepletionDate: string;
      let daysToDepletionNum: number | undefined = undefined;

      if (currentStock === 0) {
        predictedDepletionDate = "已耗尽";
        daysToDepletionNum = 0;
      } else if (avgDailyConsumptionLastWeek <= 0) {
        predictedDepletionDate = "无法预测 (上周无消耗或消耗为0)";
        daysToDepletionNum = Infinity; // Or some other indicator for "won't deplete"
      } else {
        const days = currentStock / avgDailyConsumptionLastWeek;
        daysToDepletionNum = Math.round(days);
        const depletionDate = addDays(new Date(), days);
        predictedDepletionDate = format(depletionDate, "yyyy-MM-dd", { locale: zhCN });
      }

      return {
        productId: product.id,
        productName: product.name,
        productUnit: product.unit,
        currentStock,
        avgDailyConsumptionLastWeek: parseFloat(avgDailyConsumptionLastWeek.toFixed(2)),
        predictedDepletionDate,
        daysToDepletion: daysToDepletionNum,
      };
    }).sort((a,b) => {
        // Sort by days to depletion (ascending), handle undefined/Infinity
        const daysA = a.daysToDepletion ?? Infinity;
        const daysB = b.daysToDepletion ?? Infinity;
        if (daysA === Infinity && daysB === Infinity) return a.productName.localeCompare(b.productName);
        if (daysA === Infinity) return 1; // Push Infinity to the end
        if (daysB === Infinity) return -1; // Keep non-Infinity at the front
        return daysA - daysB;
    });
  }, [hasMounted, products, transactions, getProductStockDetails]);

  if (!hasMounted) {
    // You could add a skeleton loader here if desired
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="h-8 w-8" />
                库存消耗分析
            </h1>
            <Card>
                <CardHeader>
                    <CardTitle>产品消耗预测</CardTitle>
                    <CardDescription>
                        根据上周（周一至周日）的日均消耗量和当前库存，预测产品何时将耗尽。
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>正在加载数据...</p>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  const { start: lwStart, end: lwEnd } = getPreviousFullWeekRange();


  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <BarChart3 className="h-8 w-8" />
        库存消耗分析
      </h1>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>分析说明</AlertTitle>
        <AlertDescription>
          以下分析基于 <strong>{format(lwStart, "yyyy年M月d日", {locale: zhCN})}</strong> 至 <strong>{format(lwEnd, "yyyy年M月d日", {locale: zhCN})}</strong> (上周一至上周日) 的日均消耗数据。
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>产品消耗预测</CardTitle>
          <CardDescription>
            根据上周的日均消耗量和当前库存，预测产品何时将耗尽。列表按预计耗尽日期升序排列。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysisData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品名称</TableHead>
                  <TableHead className="text-right">当前库存</TableHead>
                  <TableHead className="text-right">上周日均消耗</TableHead>
                  <TableHead>预计消耗完毕日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisData.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-right">{item.currentStock} {item.productUnit}</TableCell>
                    <TableCell className="text-right">{item.avgDailyConsumptionLastWeek.toFixed(2)} {item.productUnit}</TableCell>
                    <TableCell>
                      {item.predictedDepletionDate}
                      {item.daysToDepletion !== undefined && item.daysToDepletion !== Infinity && item.daysToDepletion >= 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (约 {item.daysToDepletion} 天后)
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              <PackageSearch className="mx-auto h-12 w-12 mb-4" />
              <p>暂无活动产品可供分析，或上周无消耗数据。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

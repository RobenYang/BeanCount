
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { ProductStockAnalysis, StockAnalysisTimeDimensionValue, StockAnalysisTimeDimensionOption } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, PackageSearch, Info, CalendarDays } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO, isWithinInterval, addDays, differenceInDays, startOfWeek, subWeeks, endOfWeek } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { useMemo, useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const TIME_DIMENSIONS: StockAnalysisTimeDimensionOption[] = [
  { value: 'YESTERDAY', label: '昨天' },
  { value: 'LAST_3_DAYS', label: '过去3天 (不含今天)' },
  { value: 'LAST_7_DAYS', label: '过去7天 (不含今天)' },
  { value: 'LAST_FULL_WEEK', label: '上一个完整周 (周一至周日)' },
  { value: 'LAST_30_DAYS', label: '过去30天 (不含今天)' },
];

interface DateRangeResult {
  start: Date;
  end: Date;
  days: number;
  label: string;
}

function getAnalysisDateRange(dimension: StockAnalysisTimeDimensionValue): DateRangeResult {
  const today = new Date();
  const todayStart = startOfDay(today); 

  switch (dimension) {
    case 'YESTERDAY':
      const yesterday = subDays(todayStart, 1);
      return { start: yesterday, end: endOfDay(yesterday), days: 1, label: `昨天 (${format(yesterday, "yyyy-MM-dd", { locale: zhCN })})` };
    case 'LAST_3_DAYS':
      const threeDaysAgoStart = subDays(todayStart, 3);
      const yesterdayEnd = endOfDay(subDays(todayStart, 1));
      return { start: threeDaysAgoStart, end: yesterdayEnd, days: 3, label: `过去3天 (${format(threeDaysAgoStart, "yy-MM-dd")} 至 ${format(subDays(todayStart, 1), "yy-MM-dd")})` };
    case 'LAST_7_DAYS':
      const sevenDaysAgoStart = subDays(todayStart, 7);
      const yesterdayEnd7 = endOfDay(subDays(todayStart, 1));
      return { start: sevenDaysAgoStart, end: yesterdayEnd7, days: 7, label: `过去7天 (${format(sevenDaysAgoStart, "yy-MM-dd")} 至 ${format(subDays(todayStart, 1), "yy-MM-dd")})` };
    case 'LAST_FULL_WEEK': 
      const startOfThisCalendarWeek = startOfWeek(today, { weekStartsOn: 1 });
      const startOfLastFullWeek = subWeeks(startOfThisCalendarWeek, 1);
      const endOfLastFullWeek = endOfWeek(startOfLastFullWeek, { weekStartsOn: 1 });
      return { start: startOfLastFullWeek, end: endOfLastFullWeek, days: 7, label: `上一个完整周 (${format(startOfLastFullWeek, "yyyy-MM-dd")} 至 ${format(endOfLastFullWeek, "yyyy-MM-dd")})` };
    case 'LAST_30_DAYS':
      const thirtyDaysAgoStart = subDays(todayStart, 30);
      const yesterdayEnd30 = endOfDay(subDays(todayStart, 1));
      return { start: thirtyDaysAgoStart, end: yesterdayEnd30, days: 30, label: `过去30天 (${format(thirtyDaysAgoStart, "yy-MM-dd")} 至 ${format(subDays(todayStart, 1), "yy-MM-dd")})` };
    default: // Fallback to LAST_FULL_WEEK
      const defaultStartThis = startOfWeek(today, { weekStartsOn: 1 });
      const defaultStartLast = subWeeks(defaultStartThis, 1);
      const defaultEndLast = endOfWeek(defaultStartLast, { weekStartsOn: 1 });
      return { start: defaultStartLast, end: defaultEndLast, days: 7, label: `上一个完整周 (${format(defaultStartLast, "yyyy-MM-dd")} 至 ${format(defaultEndLast, "yyyy-MM-dd")})` };
  }
}


export default function StockAnalysisPage() {
  const { products, transactions, getProductStockDetails, isLoadingProducts, isLoadingTransactions } = useInventory();
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedTimeDimension, setSelectedTimeDimension] = useState<StockAnalysisTimeDimensionValue>('LAST_FULL_WEEK');

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const currentAnalysisPeriod = useMemo(() => getAnalysisDateRange(selectedTimeDimension), [selectedTimeDimension]);

  const analysisData: ProductStockAnalysis[] = useMemo(() => {
    if (!hasMounted || isLoadingProducts || isLoadingTransactions) return [];

    const activeProducts = products.filter(p => !p.isArchived);
    if (activeProducts.length === 0) return [];

    const { start, end, days, label: periodLabel } = currentAnalysisPeriod;

    return activeProducts.map(product => {
      const { totalQuantity: currentStock } = getProductStockDetails(product.id);

      const transactionsInPeriod = transactions.filter(t =>
        t.productId === product.id &&
        t.type === 'OUT' &&
        !t.isCorrectionIncrease &&
        isWithinInterval(parseISO(t.timestamp), { start, end })
      );

      const totalConsumedInPeriod = transactionsInPeriod.reduce((sum, t) => sum + t.quantity, 0);
      const avgDailyConsumption = days > 0 ? totalConsumedInPeriod / days : 0;

      let predictedDepletionDate: string;
      let daysToDepletionNum: number | undefined = undefined;

      if (currentStock <= 0) {
        predictedDepletionDate = "已耗尽";
        daysToDepletionNum = 0;
      } else if (avgDailyConsumption <= 0) {
        predictedDepletionDate = "无法预测 (选定周期内无消耗)";
        daysToDepletionNum = Infinity;
      } else {
        const daysLeft = currentStock / avgDailyConsumption;
        daysToDepletionNum = Math.round(daysLeft);
        const depletionDate = addDays(new Date(), daysLeft);
        predictedDepletionDate = format(depletionDate, "yyyy-MM-dd", { locale: zhCN });
      }

      return {
        productId: product.id,
        productName: product.name,
        productUnit: product.unit,
        currentStock,
        avgDailyConsumption: parseFloat(avgDailyConsumption.toFixed(2)),
        predictedDepletionDate,
        daysToDepletion: daysToDepletionNum,
        analysisPeriodLabel: periodLabel,
      };
    }).sort((a,b) => {
        const daysA = a.daysToDepletion ?? Infinity;
        const daysB = b.daysToDepletion ?? Infinity;
        if (daysA === Infinity && daysB === Infinity) return a.productName.localeCompare(b.productName, 'zh-CN');
        if (daysA === Infinity) return 1; 
        if (daysB === Infinity) return -1;
        return daysA - daysB;
    });
  }, [hasMounted, products, transactions, getProductStockDetails, currentAnalysisPeriod, isLoadingProducts, isLoadingTransactions]);

  if (!hasMounted || isLoadingProducts || isLoadingTransactions) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="h-8 w-8" />
                库存消耗分析
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Skeleton className="h-10 w-full sm:w-64" /> {/* Select placeholder */}
            </div>
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>分析说明</AlertTitle>
                <AlertDescription>
                    <Skeleton className="h-4 w-3/4" />
                </AlertDescription>
            </Alert>
            <Card>
                <CardHeader>
                    <CardTitle><Skeleton className="h-6 w-1/2" /></CardTitle>
                    <CardDescription>
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                                <TableHead className="text-right"><Skeleton className="h-5 w-20" /></TableHead>
                                <TableHead className="text-right"><Skeleton className="h-5 w-32" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-40" /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(3)].map((_, i) => (
                                <TableRow key={`skel-${i}`}>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-16" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            库存消耗分析
        </h1>
        <div className="w-full sm:w-auto min-w-[250px]">
            <Select
                value={selectedTimeDimension}
                onValueChange={(value) => setSelectedTimeDimension(value as StockAnalysisTimeDimensionValue)}
            >
                <SelectTrigger className="w-full">
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="选择分析时间维度" />
                </SelectTrigger>
                <SelectContent>
                    {TIME_DIMENSIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>分析说明</AlertTitle>
        <AlertDescription>
          以下分析基于 <strong>{currentAnalysisPeriod.label}</strong> 的日均消耗数据。
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle>产品消耗预测</CardTitle>
          <CardDescription>
            根据选定周期内的日均消耗量和当前库存，预测产品何时将耗尽。列表按预计耗尽日期升序排列。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysisData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品名称</TableHead>
                  <TableHead className="text-right">当前库存</TableHead>
                  <TableHead className="text-right">选定周期日均消耗</TableHead>
                  <TableHead>预计消耗完毕日期</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisData.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-right">{item.currentStock} {item.productUnit}</TableCell>
                    <TableCell className="text-right">{item.avgDailyConsumption.toFixed(2)} {item.productUnit}</TableCell>
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
              <p>暂无活动产品可供分析，或选定周期内无消耗数据。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

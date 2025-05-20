
"use client";

import { useState, useMemo, useEffect } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import type { Product, Batch, Transaction, ChartDataPoint, ChartTimeScaleValue } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, LineChart as LineChartIcon, Loader2, AlertTriangle } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval, startOfWeek, startOfMonth, parseISO, endOfDay, isWithinInterval, addMonths, subMonths, subWeeks, addWeeks, isAfter, isBefore } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { Skeleton } from "@/components/ui/skeleton";

const CHART_TIMESCALE_OPTIONS = [
  { value: 'LAST_7_DAYS_DAILY', label: '每日 (过去7天)' },
  { value: 'LAST_30_DAYS_DAILY', label: '每日 (过去30天)' },
  { value: 'LAST_3_MONTHS_WEEKLY', label: '每周 (过去3个月)' },
  { value: 'LAST_12_MONTHS_MONTHLY', label: '每月 (过去12个月)' },
];

function calculateHistoricalStockData(
  productId: string,
  timeScale: ChartTimeScaleValue, 
  allBatches: Batch[],
  allTransactions: Transaction[]
): ChartDataPoint[] {
  const today = endOfDay(new Date());
  let startDate: Date;
  let reportDates: Date[] = [];
  const productBatches = allBatches.filter(b => b.productId === productId);

  switch (timeScale) {
    case 'LAST_7_DAYS_DAILY':
      startDate = subDays(today, 6);
      reportDates = eachDayOfInterval({ start: startDate, end: today });
      break;
    case 'LAST_30_DAYS_DAILY':
      startDate = subDays(today, 29);
      reportDates = eachDayOfInterval({ start: startDate, end: today });
      break;
    case 'LAST_3_MONTHS_WEEKLY':
      startDate = startOfWeek(subMonths(today, 3), { locale: zhCN });
      let currentDateW = startDate;
      while (currentDateW <= today) {
          reportDates.push(endOfDay(currentDateW));
          currentDateW = addWeeks(currentDateW, 1);
          if (reportDates.length > 15 && reportDates.length < 20) { 
          } else if (reportDates.length >=20) break;
      }
      break;
    case 'LAST_12_MONTHS_MONTHLY':
      startDate = startOfMonth(subMonths(today, 11));
      let currentDateM = startDate;
      while (currentDateM <= today) {
          reportDates.push(endOfDay(currentDateM));
          currentDateM = addMonths(currentDateM, 1);
           if (reportDates.length > 15) break; 
      }
      break;
    default:
      return [];
  }
  
  reportDates = Array.from(new Set(reportDates.map(d => d.toISOString()))).map(ds => parseISO(ds)).sort((a,b) => a.getTime() - b.getTime());
  reportDates = reportDates.filter(date => date <= today); 

  return reportDates.map(reportDate => {
    let totalValueForDate = 0;
    let totalQuantityForDate = 0;

    productBatches.forEach(batch => {
      if (isAfter(parseISO(batch.createdAt), reportDate)) {
        return;
      }

      let quantityInBatchAtReportDate = batch.initialQuantity;
      const transactionsForBatchBeforeOrOnReportDate = allTransactions.filter(
        t => t.batchId === batch.id &&
             !isAfter(parseISO(t.timestamp), reportDate) 
      );

      transactionsForBatchBeforeOrOnReportDate.forEach(t => {
        if (t.type === 'OUT') {
           if (t.isCorrectionIncrease) { // If it was a negative outflow (correction increase)
            quantityInBatchAtReportDate += t.quantity; // Add back
          } else {
            quantityInBatchAtReportDate -= t.quantity; // Normal outflow
          }
        }
      });
      
      quantityInBatchAtReportDate = Math.max(0, quantityInBatchAtReportDate);
      
      if (quantityInBatchAtReportDate > 0 && !isBefore(parseISO(batch.expiryDate), reportDate) ) {
        totalValueForDate += quantityInBatchAtReportDate * batch.unitCost;
        totalQuantityForDate += quantityInBatchAtReportDate;
      }
    });

    let dateFormatString = "MM-dd";
    if (timeScale === 'LAST_3_MONTHS_WEEKLY') dateFormatString = "yy/MM/dd";
    if (timeScale === 'LAST_12_MONTHS_MONTHLY') dateFormatString = "yyyy-MM";

    return {
      date: format(reportDate, dateFormatString, { locale: zhCN }),
      stockValue: parseFloat(totalValueForDate.toFixed(2)),
      quantity: totalQuantityForDate,
    };
  });
}


export function StockValuationChartView() {
  const { products, batches, transactions, getProductById } = useInventory();
  const activeProducts = useMemo(() => products.filter(p => !p.isArchived), [products]);

  const [hasMounted, setHasMounted] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [selectedTimeScale, setSelectedTimeScale] = useState<ChartTimeScaleValue>(CHART_TIMESCALE_OPTIONS[0].value);
  const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted) {
      if (activeProducts.length > 0) {
        const currentSelectionIsValid = selectedProductId && activeProducts.some(p => p.id === selectedProductId);
        if (!currentSelectionIsValid) {
          setSelectedProductId(activeProducts[0].id);
        }
      } else {
        setSelectedProductId(undefined);
      }
    }
  }, [hasMounted, activeProducts, selectedProductId]);

  const handleGenerateChart = () => {
    if (!selectedProductId) {
      setError("请选择一个产品。");
      setChartData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = calculateHistoricalStockData(selectedProductId, selectedTimeScale, batches, transactions);
      setChartData(data);
      if (data.length === 0) {
        setError("选择的时间范围内无数据或产品无库存记录。");
      }
    } catch (e) {
      console.error("生成图表数据时出错:", e);
      setError("生成图表数据失败，请检查控制台获取更多信息。");
      setChartData(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (hasMounted && selectedProductId) {
      handleGenerateChart();
    } else if (hasMounted && !selectedProductId && activeProducts.length > 0) {
       setError("请选择一个产品以查看图表。");
       setChartData(null);
    } else if (hasMounted && activeProducts.length === 0) {
      setError("无可用产品进行分析。");
      setChartData(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, selectedProductId, selectedTimeScale]); // Removed batches, transactions from deps to avoid re-render on every transaction


  const chartConfig = {
    stockValue: {
      label: "库存价值 (¥)",
      color: "hsl(var(--chart-1))",
    },
    quantity: {
      label: "库存数量",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;
  
  const selectedProduct = getProductById(selectedProductId || "");
  const selectedProductName = selectedProduct?.name || "";
  const selectedProductUnit = selectedProduct?.unit || "";

  if (!hasMounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-6 w-6" />
            库存变化图表
          </CardTitle>
          <CardDescription>
            选择产品和时间范围以可视化其库存价值（基于入库成本）和数量随时间的变化。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-10 w-full" /> 
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full sm:w-auto" />
          </div>
          <div className="flex items-center justify-center h-72">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">正在加载图表组件...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="h-6 w-6" />
          库存变化图表
        </CardTitle>
        <CardDescription>
          选择产品和时间范围以可视化其库存价值（基于入库成本）和数量随时间的变化。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select 
            onValueChange={setSelectedProductId} 
            value={selectedProductId || undefined}
            disabled={activeProducts.length === 0 || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder="选择一个产品" />
            </SelectTrigger>
            <SelectContent>
              {activeProducts.length > 0 ? activeProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              )) : <SelectItem value="no-products" disabled>无可用产品</SelectItem>}
            </SelectContent>
          </Select>

          <Select onValueChange={(value) => setSelectedTimeScale(value as ChartTimeScaleValue)} value={selectedTimeScale} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder="选择时间范围" />
            </SelectTrigger>
            <SelectContent>
              {CHART_TIMESCALE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={handleGenerateChart} disabled={isLoading || !selectedProductId} className="w-full sm:w-auto">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="mr-2 h-4 w-4" />
            )}
            {isLoading ? "生成中..." : "刷新图表"}
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-72">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">正在加载图表数据...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center h-72 text-destructive">
            <AlertTriangle className="h-8 w-8 mb-2" />
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && chartData && chartData.length > 0 && (
          <div className="h-[450px] w-full">
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full h-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }} 
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis 
                    yAxisId="left"
                    dataKey="stockValue" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8} 
                    tickFormatter={(value) => `¥${value}`} 
                    domain={['auto', 'auto']}
                    stroke="hsl(var(--chart-1))"
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    dataKey="quantity"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => `${value} ${selectedProductUnit}`}
                    domain={['auto', 'auto']}
                    stroke="hsl(var(--chart-2))"
                  />
                  <ChartTooltip
                    cursor={true}
                    content={<ChartTooltipContent 
                                hideLabel 
                                formatter={(value, name, props) => {
                                  if (name === 'stockValue') {
                                    return [`¥${(value as number).toFixed(2)}`, chartConfig.stockValue.label];
                                  }
                                  if (name === 'quantity') {
                                    return [`${value} ${selectedProductUnit}`, chartConfig.quantity.label];
                                  }
                                  return [value, name];
                                }}
                            />}
                  />
                  <Line
                    yAxisId="left"
                    dataKey="stockValue"
                    type="monotone"
                    stroke={`hsl(var(--chart-1))`}
                    strokeWidth={2}
                    dot={true}
                    name={selectedProductName ? `${selectedProductName} ${chartConfig.stockValue.label}` : chartConfig.stockValue.label}
                  />
                   <Line
                    yAxisId="right"
                    dataKey="quantity"
                    type="monotone"
                    stroke={`hsl(var(--chart-2))`}
                    strokeWidth={2}
                    dot={true}
                    name={selectedProductName ? `${selectedProductName} ${chartConfig.quantity.label}` : chartConfig.quantity.label}
                  />
                  <Legend content={<ChartLegendContent />} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        )}
         {!isLoading && !error && chartData && chartData.length === 0 && (
            <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
                <LineChartIcon className="h-12 w-12 mb-4" />
                <p className="text-lg">暂无数据显示</p>
                <p className="text-sm">请尝试调整筛选条件或添加库存记录。</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

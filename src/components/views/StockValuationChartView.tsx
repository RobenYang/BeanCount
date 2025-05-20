
"use client";

import { useState, useMemo } from "react";
import { useInventory } from "@/contexts/InventoryContext";
import type { Product, Batch, Transaction } from "@/lib/types";
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
import { format, subDays, eachDayOfInterval, startOfWeek, startOfMonth, parseISO, endOfDay, isWithinInterval, addMonths, subMonths, subWeeks, addWeeks, getDaysInMonth } from "date-fns";
import { zhCN } from 'date-fns/locale';

const CHART_TIMESCALE_OPTIONS = [
  { value: 'LAST_7_DAYS_DAILY', label: '每日 (过去7天)' },
  { value: 'LAST_30_DAYS_DAILY', label: '每日 (过去30天)' },
  { value: 'LAST_3_MONTHS_WEEKLY', label: '每周 (过去3个月)' },
  { value: 'LAST_12_MONTHS_MONTHLY', label: '每月 (过去12个月)' },
];

interface ChartDataPoint {
  date: string; // Formatted date string for X-axis
  productValue: number; // Stock value for Y-axis
}

function calculateHistoricalStockValue(
  productId: string,
  timeScale: string,
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
      while (isWithinInterval(currentDateW, { start: subMonths(today,3), end: addWeeks(today,1)  })) { // ensure current week is included
         if(isWithinInterval(currentDateW, { start: subMonths(today,3), end: today  })){
            reportDates.push(endOfDay(currentDateW));
         }
        currentDateW = addWeeks(currentDateW, 1);
         if (reportDates.length > 15) break; // Safety break
      }
      reportDates = reportDates.filter(date => !isBefore(date, startDate) && !isAfter(date, today));
      if (reportDates.length === 0 && isWithinInterval(startOfWeek(today, {locale: zhCN}), { start: subMonths(today,3), end: today  })) {
        reportDates.push(endOfDay(startOfWeek(today, {locale: zhCN}))); // Ensure at least one point if current week is in range
      }
      break;
    case 'LAST_12_MONTHS_MONTHLY':
      startDate = startOfMonth(subMonths(today, 11));
       let currentDateM = startDate;
      while (isWithinInterval(currentDateM, { start: subMonths(today,11), end: addMonths(today,1) })) { // ensure current month is included
        if(isWithinInterval(currentDateM, { start: subMonths(today,11), end: today })) {
            reportDates.push(endOfDay(currentDateM));
        }
        currentDateM = addMonths(currentDateM, 1);
        if (reportDates.length > 15) break; // Safety break
      }
      reportDates = reportDates.filter(date => !isBefore(date, startDate) && !isAfter(date, today));
       if (reportDates.length === 0 && isWithinInterval(startOfMonth(today), { start: subMonths(today,11), end: today  })) {
        reportDates.push(endOfDay(startOfMonth(today))); // Ensure at least one point if current month is in range
      }
      break;
    default:
      return [];
  }
  
  // Ensure reportDates are sorted and unique
  reportDates = Array.from(new Set(reportDates.map(d => d.toISOString()))).map(ds => parseISO(ds)).sort((a,b) => a.getTime() - b.getTime());


  return reportDates.map(reportDate => {
    let totalValueForDate = 0;
    productBatches.forEach(batch => {
      // Batch must exist at or before the report date
      if (isAfter(parseISO(batch.createdAt), reportDate)) {
        return;
      }

      let quantityInBatchAtReportDate = batch.initialQuantity;
      const outflowsForBatch = allTransactions.filter(
        t => t.batchId === batch.id &&
             t.type === 'OUT' &&
             !isAfter(parseISO(t.timestamp), reportDate) // Transaction at or before reportDate
      );

      const totalOutflowQuantity = outflowsForBatch.reduce((sum, t) => sum + t.quantity, 0);
      quantityInBatchAtReportDate -= totalOutflowQuantity;
      quantityInBatchAtReportDate = Math.max(0, quantityInBatchAtReportDate);
      
      totalValueForDate += quantityInBatchAtReportDate * batch.unitCost;
    });

    let dateFormatString = "MM-dd";
    if (timeScale === 'LAST_3_MONTHS_WEEKLY') dateFormatString = "yy/MM/dd"; // Representing week start
    if (timeScale === 'LAST_12_MONTHS_MONTHLY') dateFormatString = "yyyy-MM";

    return {
      date: format(reportDate, dateFormatString, { locale: zhCN }),
      productValue: parseFloat(totalValueForDate.toFixed(2)),
    };
  });
}

// Helper function to check if a date is after another date
function isAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}

// Helper function to check if a date is before another date
function isBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() < date2.getTime();
}

export function StockValuationChartView() {
  const { products, batches, transactions } = useInventory();
  const activeProducts = useMemo(() => products.filter(p => !p.isArchived), [products]);

  const [selectedProductId, setSelectedProductId] = useState<string | null>(activeProducts.length > 0 ? activeProducts[0].id : null);
  const [selectedTimeScale, setSelectedTimeScale] = useState<string>(CHART_TIMESCALE_OPTIONS[0].value);
  const [chartData, setChartData] = useState<ChartDataPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateChart = () => {
    if (!selectedProductId) {
      setError("请选择一个产品。");
      setChartData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = calculateHistoricalStockValue(selectedProductId, selectedTimeScale, batches, transactions);
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
  
  // Automatically generate chart when product or timescale changes, if a product is selected
  useEffect(() => {
    if (selectedProductId) {
      handleGenerateChart();
    } else {
      setChartData(null); // Clear chart if no product selected
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, selectedTimeScale, batches, transactions]); // Re-calculate if underlying data changes


  const chartConfig = {
    productValue: {
      label: "库存价值 ($)",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;
  
  const selectedProductName = activeProducts.find(p => p.id === selectedProductId)?.name || "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="h-6 w-6" />
          库存价值图表分析
        </CardTitle>
        <CardDescription>
          选择产品和时间范围以可视化库存价值随时间的变化。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select onValueChange={setSelectedProductId} value={selectedProductId || undefined} disabled={activeProducts.length === 0}>
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

          <Select onValueChange={setSelectedTimeScale} value={selectedTimeScale}>
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
          <div className="h-72 w-full">
            <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: -20, bottom: 5 }} // Adjusted left margin
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis 
                    dataKey="productValue" 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={8} 
                    tickFormatter={(value) => `$${value}`} 
                    domain={['auto', 'auto']}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Line
                    dataKey="productValue"
                    type="monotone"
                    stroke={`hsl(var(--primary))`} // Using primary color from theme
                    strokeWidth={2}
                    dot={false}
                    name={selectedProductName ? `${selectedProductName} 库存价值` : "库存价值"}
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


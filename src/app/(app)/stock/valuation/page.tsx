
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockValuationForm } from '@/components/forms/StockValuationForm';
import { StockValuationChartView } from '@/components/views/StockValuationChartView';
import { BarChart3, Bot, LineChart } from "lucide-react";

export default function StockStatisticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <BarChart3 className="h-8 w-8" />
        库存统计
      </h1>
      <Tabs defaultValue="chart-analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chart-analysis">
            <LineChart className="mr-2 h-4 w-4" />
            图表分析
          </TabsTrigger>
          <TabsTrigger value="ai-summary">
            <Bot className="mr-2 h-4 w-4" />
            AI 分析摘要
          </TabsTrigger>
        </TabsList>
        <TabsContent value="chart-analysis">
          <StockValuationChartView />
        </TabsContent>
        <TabsContent value="ai-summary">
          <StockValuationForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}



"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StockValuationForm } from '@/components/forms/StockValuationForm';
import { StockValuationChartView } from '@/components/views/StockValuationChartView';
import { BarChart3, Bot } from "lucide-react";

export default function StockValuationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <BarChart3 className="h-8 w-8" />
        库存估值
      </h1>
      <Tabs defaultValue="ai-summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="ai-summary">
            <Bot className="mr-2 h-4 w-4" />
            AI 估值摘要
          </TabsTrigger>
          <TabsTrigger value="chart-analysis">
            <BarChart3 className="mr-2 h-4 w-4" />
            图表分析
          </TabsTrigger>
        </TabsList>
        <TabsContent value="ai-summary">
          <StockValuationForm />
        </TabsContent>
        <TabsContent value="chart-analysis">
          <StockValuationChartView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

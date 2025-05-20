
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stockValuationSummary, type StockValuationSummaryInput, type StockValuationSummaryOutput } from "@/ai/flows/stock-valuation-summary";
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Loader2 } from "lucide-react";
import { OUTFLOW_REASONS_WITH_LABELS, TIMESCALE_OPTIONS } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInventory } from "@/contexts/InventoryContext";

const stockValuationFormSchema = z.object({
  productId: z.string().min(1, "必须选择产品。"),
  timeScale: z.string().min(1, "必须选择时间范围。"),
  outflowReason: z.string().min(1, "必须选择出库原因。"),
});

type StockValuationFormValues = z.infer<typeof stockValuationFormSchema>;

export function StockValuationForm() {
  const { products } = useInventory();
  const activeProducts = useMemo(() => products.filter(p => !p.isArchived), [products]);

  const [summary, setSummary] = useState<StockValuationSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<StockValuationFormValues>({
    resolver: zodResolver(stockValuationFormSchema),
    defaultValues: {
      productId: activeProducts.length > 0 ? activeProducts[0].id : "",
      timeScale: TIMESCALE_OPTIONS[0].value,
      outflowReason: "ALL", 
    },
  });
   // Effect to update default productId if activeProducts change and current selection is invalid or not set
  useState(() => {
    if (activeProducts.length > 0 && (!form.getValues("productId") || !activeProducts.find(p => p.id === form.getValues("productId")))) {
      form.setValue("productId", activeProducts[0].id);
    }
  });


  async function onSubmit(data: StockValuationFormValues) {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    try {
      const inputForAI: StockValuationSummaryInput = {
        productId: data.productId,
        timeScale: data.timeScale,
        outflowReason: data.outflowReason,
      };
      const result = await stockValuationSummary(inputForAI);
      setSummary(result);
    } catch (e) {
      console.error("生成AI库存分析摘要时出错:", e);
      setError("生成摘要失败。请重试。");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI 库存分析摘要
          </CardTitle>
          <CardDescription>
            选择产品、时间范围和出库原因，生成AI驱动的库存变化分析摘要。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>产品</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={activeProducts.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择一个产品" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeProducts.length > 0 ? activeProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        )) : <SelectItem value="no-product" disabled>无可用产品</SelectItem>}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="timeScale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>时间范围</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择一个时间范围" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMESCALE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="outflowReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>出库原因 (筛选)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择一个出库原因" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ALL">所有原因</SelectItem>
                        {OUTFLOW_REASONS_WITH_LABELS.filter(r => r.value !== 'ADJUSTMENT_INCREASE').map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isLoading || activeProducts.length === 0}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="mr-2 h-4 w-4" />
                )}
                生成摘要
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="max-w-2xl mx-auto mt-6">
          <CardContent className="pt-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">正在生成摘要...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="max-w-2xl mx-auto mt-6" variant="destructive">
          <CardHeader>
            <CardTitle>错误</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card className="max-w-2xl mx-auto mt-6">
          <CardHeader>
            <CardTitle>AI 分析摘要结果</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <p className="whitespace-pre-wrap">{summary.summary}</p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



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
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Loader2 } from "lucide-react";
import { OUTFLOW_REASONS_WITH_LABELS, TIMESCALE_OPTIONS, type OutflowReasonItem } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

const stockValuationFormSchema = z.object({
  timeScale: z.string().min(1, "必须选择时间范围。"),
  outflowReason: z.string().min(1, "必须选择出库原因。"),
});

type StockValuationFormValues = z.infer<typeof stockValuationFormSchema>;

export function StockValuationForm() {
  const [summary, setSummary] = useState<StockValuationSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<StockValuationFormValues>({
    resolver: zodResolver(stockValuationFormSchema),
    defaultValues: {
      timeScale: TIMESCALE_OPTIONS[0].value,
      outflowReason: "ALL", // Default to "All Reasons"
    },
  });

  async function onSubmit(data: StockValuationFormValues) {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    try {
      // The AI flow expects English enum-like values for outflowReason
      const inputForAI: StockValuationSummaryInput = {
        timeScale: data.timeScale,
        outflowReason: data.outflowReason, // This is already the 'value' field like 'SALE' or 'ALL'
      };
      const result = await stockValuationSummary(inputForAI);
      setSummary(result);
    } catch (e) {
      console.error("生成库存估值摘要时出错:", e);
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
            <BarChart3 className="h-6 w-6" />
            库存估值摘要
          </CardTitle>
          <CardDescription>
            根据所选筛选条件生成AI驱动的库存估值摘要。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <FormLabel>出库原因</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择一个出库原因" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ALL">所有原因</SelectItem>
                        {OUTFLOW_REASONS_WITH_LABELS.map((reason) => (
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
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="mr-2 h-4 w-4" />
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
            <CardTitle>估值摘要结果</CardTitle>
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

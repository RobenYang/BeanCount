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
import { OUTFLOW_REASONS, TIMESCALE_OPTIONS, type OutflowReason } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";

const stockValuationFormSchema = z.object({
  timeScale: z.string().min(1, "Time scale selection is required."),
  outflowReason: z.string().min(1, "Outflow reason selection is required."),
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
      outflowReason: OUTFLOW_REASONS[0],
    },
  });

  async function onSubmit(data: StockValuationFormValues) {
    setIsLoading(true);
    setError(null);
    setSummary(null);
    try {
      const result = await stockValuationSummary(data as StockValuationSummaryInput);
      setSummary(result);
    } catch (e) {
      console.error("Error generating stock valuation summary:", e);
      setError("Failed to generate summary. Please try again.");
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
            Stock Valuation Summary
          </CardTitle>
          <CardDescription>
            Generate an AI-powered summary of stock valuation based on selected filters.
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
                    <FormLabel>Time Scale</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a time scale" />
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
                    <FormLabel>Outflow Reason</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an outflow reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OUTFLOW_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                        <SelectItem value="ALL">All Reasons</SelectItem>
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
                Generate Summary
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="max-w-2xl mx-auto mt-6">
          <CardContent className="pt-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Generating summary...</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="max-w-2xl mx-auto mt-6" variant="destructive">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card className="max-w-2xl mx-auto mt-6">
          <CardHeader>
            <CardTitle>Valuation Summary Result</CardTitle>
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

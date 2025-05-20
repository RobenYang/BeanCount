
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventory } from "@/contexts/InventoryContext";
import type { OutflowReasonItem, Batch } from "@/lib/types"; // Added Batch
import { OUTFLOW_REASONS_WITH_LABELS } from "@/lib/types";
import { PackageMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react"; // Added useState, useEffect, useMemo
import { format, parseISO } from "date-fns"; // Added format, parseISO
import { zhCN } from 'date-fns/locale';


const stockOutflowFormSchema = z.object({
  productId: z.string().min(1, "必须选择产品。"),
  batchId: z.string().min(1, "必须选择批次。"),
  quantity: z.coerce.number().positive("数量必须是正数。"),
  reason: z.enum(OUTFLOW_REASONS_WITH_LABELS.map(r => r.value) as [string, ...string[]], {
    required_error: "出库原因为必填项。",
  }),
  notes: z.string().optional(),
});

type StockOutflowFormValues = z.infer<typeof stockOutflowFormSchema>;

export function StockOutflowForm() {
  const { products, recordOutflowFromSpecificBatch, getBatchesByProductId, getProductById } = useInventory();
  const activeProducts = products.filter(p => !p.isArchived);

  const form = useForm<StockOutflowFormValues>({
    resolver: zodResolver(stockOutflowFormSchema),
    defaultValues: {
      productId: "",
      batchId: "",
      quantity: 0,
      notes: "",
    },
  });

  const selectedProductId = form.watch("productId");
  const selectedBatchId = form.watch("batchId");

  const [availableBatches, setAvailableBatches] = useState<Batch[]>([]);

  const productUnit = useMemo(() => {
    if (!selectedProductId) return "";
    return getProductById(selectedProductId)?.unit || "";
  }, [selectedProductId, getProductById]);

  useEffect(() => {
    if (selectedProductId) {
      const productBatches = getBatchesByProductId(selectedProductId)
        .filter(b => b.currentQuantity > 0)
        .sort((a, b) => parseISO(a.productionDate).getTime() - parseISO(b.productionDate).getTime()); // Sort by production date
      setAvailableBatches(productBatches);
      form.setValue("batchId", ""); 
    } else {
      setAvailableBatches([]);
    }
  }, [selectedProductId, getBatchesByProductId, form]);

  const selectedBatchDetails = useMemo(() => {
    return availableBatches.find(b => b.id === selectedBatchId);
  }, [availableBatches, selectedBatchId]);

  function onSubmit(data: StockOutflowFormValues) {
    const { productId, batchId, quantity, reason, notes } = data;
    
    const batchToOutflow = availableBatches.find(b => b.id === batchId);
    if (!batchToOutflow) {
      form.setError("batchId", { type: "manual", message: "选择的批次信息无效或已无库存。" });
      return;
    }
    if (quantity > batchToOutflow.currentQuantity) {
      form.setError("quantity", { type: "manual", message: `数量不能超过所选批次的可用库存 (${batchToOutflow.currentQuantity} ${productUnit})。` });
      return;
    }

    recordOutflowFromSpecificBatch(productId, batchId, quantity, data.reason as OutflowReasonItem['value'], data.notes);
    form.reset();
    setAvailableBatches([]); // Clear available batches after successful submission
  }


  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageMinus className="h-6 w-6" />
          记录出库/消耗
        </CardTitle>
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
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择一个产品" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.unit})
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
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>批次</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || ""}
                    disabled={!selectedProductId || availableBatches.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={!selectedProductId ? "请先选择产品" : (availableBatches.length === 0 ? "该产品无可用批次" : "选择一个批次")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableBatches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          生产: {format(parseISO(batch.productionDate), "yyyy-MM-dd", { locale: zhCN })} | 
                          数量: {batch.currentQuantity} {productUnit} | 
                          过期: {format(parseISO(batch.expiryDate), "yyyy-MM-dd", { locale: zhCN })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBatchDetails && (
                    <p className="text-sm text-muted-foreground mt-1">
                      选中批次可用库存: {selectedBatchDetails.currentQuantity} {productUnit}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>出库数量 ({productUnit})</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="例如: 2" {...field} disabled={!selectedBatchId} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>出库原因</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""} disabled={!selectedBatchId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择一个原因" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OUTFLOW_REASONS_WITH_LABELS.map((reasonItem) => (
                        <SelectItem key={reasonItem.value} value={reasonItem.value}>
                          {reasonItem.label}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注 (可选)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="例如: 用于活动餐饮, 物品损坏" {...field} disabled={!selectedBatchId} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={!form.formState.isValid || !selectedBatchId}>
              <PackageMinus className="mr-2 h-4 w-4" /> 记录出库
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


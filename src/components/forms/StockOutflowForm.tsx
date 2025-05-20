
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
import { type OutflowReasonItem, OUTFLOW_REASONS_WITH_LABELS } from "@/lib/types";
import { PackageMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stockOutflowFormSchema = z.object({
  productId: z.string().min(1, "必须选择产品。"),
  quantity: z.coerce.number().positive("数量必须是正数。"),
  reason: z.enum(OUTFLOW_REASONS_WITH_LABELS.map(r => r.value) as [string, ...string[]], {
    required_error: "出库原因为必填项。",
  }),
  notes: z.string().optional(),
});

type StockOutflowFormValues = z.infer<typeof stockOutflowFormSchema>;

export function StockOutflowForm() {
  const { products, recordOutflow, getProductStockDetails } = useInventory();
  const activeProducts = products.filter(p => !p.isArchived);

  const form = useForm<StockOutflowFormValues>({
    resolver: zodResolver(stockOutflowFormSchema),
    defaultValues: {
      productId: "",
      quantity: 0,
      notes: "",
    },
  });

  function onSubmit(data: StockOutflowFormValues) {
    recordOutflow(data.productId, data.quantity, data.reason as OutflowReasonItem['value'], data.notes);
    form.reset();
  }

  const selectedProductId = form.watch("productId");
  const stockDetails = selectedProductId ? getProductStockDetails(selectedProductId) : null;

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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  {stockDetails && (
                    <p className="text-sm text-muted-foreground mt-1">
                      可用库存: {stockDetails.totalQuantity} {products.find(p=>p.id === selectedProductId)?.unit}
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
                  <FormLabel>出库数量</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="例如: 2" {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Textarea placeholder="例如: 用于活动餐饮, 物品损坏" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              <PackageMinus className="mr-2 h-4 w-4" /> 记录出库
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

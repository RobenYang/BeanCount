
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
import type { OutflowReasonItem, Batch } from "@/lib/types"; 
import { OUTFLOW_REASONS_WITH_LABELS } from "@/lib/types";
import { PackageMinus, Image as ImageIconLucide } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useMemo } from "react"; 
import { format, parseISO } from "date-fns"; 
import { zhCN } from 'date-fns/locale';
import NextImage from "next/image";


const stockOutflowFormSchema = z.object({
  productId: z.string().min(1, "必须选择产品。"),
  batchId: z.string().min(1, "必须选择批次。"),
  quantity: z.coerce
    .number({ invalid_type_error: "数量必须是有效的数字。" })
    .refine(val => val !== 0, { message: "数量不能为零。" }),
  reason: z.enum(OUTFLOW_REASONS_WITH_LABELS.map(r => r.value) as [string, ...string[]], {
    required_error: "出库原因为必填项。",
  }),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.quantity < 0 && data.reason !== 'ADJUSTMENT_DECREASE') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "当出库数量为负数时，原因必须是“误操作修正”。",
      path: ["reason"],
    });
  }
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
      quantity: undefined, // Changed to undefined to handle placeholder
      notes: "",
      reason: undefined, 
    },
  });

  const selectedProductId = form.watch("productId");
  const selectedBatchId = form.watch("batchId");
  const selectedQuantity = form.watch("quantity");

  const [availableBatches, setAvailableBatches] = useState<Batch[]>([]);
  
  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return getProductById(selectedProductId);
  }, [selectedProductId, getProductById]);

  const productUnit = selectedProduct?.unit || "";

  useEffect(() => {
    if (selectedProductId) {
      const productBatches = getBatchesByProductId(selectedProductId)
        .filter(b => b.currentQuantity > 0 || (typeof selectedQuantity === 'number' && selectedQuantity < 0))
        .sort((a, b) => {
            const dateA = a.expiryDate ? parseISO(a.expiryDate) : (a.productionDate ? parseISO(a.productionDate) : parseISO(a.createdAt));
            const dateB = b.expiryDate ? parseISO(b.expiryDate) : (b.productionDate ? parseISO(b.productionDate) : parseISO(b.createdAt));
            return dateA.getTime() - dateB.getTime(); // FIFO for expiry, then production, then creation
        });
      setAvailableBatches(productBatches);
      if (!productBatches.find(b => b.id === form.getValues("batchId"))) {
        form.setValue("batchId", ""); 
      }
    } else {
      setAvailableBatches([]);
      form.setValue("batchId", "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, getBatchesByProductId, form.setValue, form.getValues, selectedQuantity]);

  const selectedBatchDetails = useMemo(() => {
    return availableBatches.find(b => b.id === selectedBatchId);
  }, [availableBatches, selectedBatchId]);

  useEffect(() => {
    const qtyValue = typeof selectedQuantity === 'number' ? selectedQuantity : 0;
    if (qtyValue < 0) {
      form.setValue("reason", "ADJUSTMENT_DECREASE", { shouldValidate: true });
    }
  }, [selectedQuantity, form]);


  function onSubmit(data: StockOutflowFormValues) {
    const { productId, batchId, quantity, reason, notes } = data;
    const numericQuantity = Number(quantity); // Ensure quantity is a number

    const batchToOutflow = availableBatches.find(b => b.id === batchId);
    if (!batchToOutflow && numericQuantity > 0) { 
      form.setError("batchId", { type: "manual", message: "选择的批次信息无效或已无库存。" });
      return;
    }
    
    if (numericQuantity > 0 && batchToOutflow && numericQuantity > batchToOutflow.currentQuantity) {
      form.setError("quantity", { type: "manual", message: `数量 (${numericQuantity} ${productUnit}) 不能超过所选批次的可用库存 (${batchToOutflow.currentQuantity} ${productUnit})。` });
      return;
    }

    recordOutflowFromSpecificBatch(productId, batchId, numericQuantity, data.reason as OutflowReasonValue, data.notes);
    form.reset({
        productId: "",
        batchId: "",
        quantity: undefined,
        reason: undefined,
        notes: "",
    });
    setAvailableBatches([]); 
  }
  
  const placeholderImage = `https://placehold.co/64x64.png?text=${encodeURIComponent(selectedProduct?.name?.substring(0,1) || '?')}`;
  const imageSrc = selectedProduct?.imageUrl || placeholderImage;

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
            
            {selectedProduct && (
              <div className="my-4 flex items-center gap-4 p-3 border rounded-md bg-muted/30">
                <NextImage
                  src={imageSrc}
                  alt={selectedProduct.name}
                  width={64}
                  height={64}
                  className="rounded-md object-cover aspect-square"
                  data-ai-hint="product item"
                />
                <div>
                    <h4 className="font-semibold">{selectedProduct.name}</h4>
                    <p className="text-sm text-muted-foreground">
                        类别: {selectedProduct.category === 'INGREDIENT' ? '食材' : '非食材'} | 单位: {productUnit}
                    </p>
                </div>
              </div>
            )}

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
                        <SelectValue placeholder={!selectedProductId ? "请先选择产品" : (availableBatches.length === 0 && (typeof selectedQuantity !== 'number' || selectedQuantity >= 0) ? "该产品无可用批次" : "选择一个批次")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableBatches.map((batch) => {
                         let batchLabel = "";
                         if (selectedProduct?.category === 'INGREDIENT') {
                            batchLabel = `生产: ${batch.productionDate ? format(parseISO(batch.productionDate), "yy-MM-dd", { locale: zhCN }) : 'N/A'} | 数量: ${batch.currentQuantity} ${productUnit} | 过期: ${batch.expiryDate ? format(parseISO(batch.expiryDate), "yy-MM-dd", { locale: zhCN }) : 'N/A'}`;
                         } else {
                            batchLabel = `入库/生产: ${batch.productionDate ? format(parseISO(batch.productionDate), "yy-MM-dd", { locale: zhCN }) : (batch.createdAt ? format(parseISO(batch.createdAt), "yy-MM-dd", { locale: zhCN }) : 'N/A')} | 数量: ${batch.currentQuantity} ${productUnit}`;
                         }
                         return (
                            <SelectItem key={batch.id} value={batch.id}>
                                {batchLabel}
                            </SelectItem>
                         );
                      })}
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
                    <Input 
                      type="number" 
                      placeholder="例如: 2 (负数表示更正)" 
                      {...field} 
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : parseFloat(val));
                      }}
                      disabled={!selectedBatchId} 
                    />
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
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || ""} 
                    disabled={!selectedBatchId || (typeof selectedQuantity === 'number' && selectedQuantity < 0)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择一个原因" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OUTFLOW_REASONS_WITH_LABELS.map((reasonItem) => (
                        <SelectItem 
                          key={reasonItem.value} 
                          value={reasonItem.value}
                          disabled={(typeof selectedQuantity === 'number' && selectedQuantity < 0) && reasonItem.value !== 'ADJUSTMENT_DECREASE'}
                        >
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

    
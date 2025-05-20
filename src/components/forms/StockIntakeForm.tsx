
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventory } from "@/contexts/InventoryContext";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format, isValid, parseISO } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, Archive, Image as ImageIconLucide } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useMemo } from "react"; // Added useMemo
import NextImage from "next/image";
import { toast } from "@/hooks/use-toast";


const stockIntakeFormSchemaBase = z.object({
  productId: z.string().min(1, "必须选择产品。"),
  productionDate: z.date().optional().nullable(), 
  initialQuantity: z.coerce.number().min(1, { message: "接收数量至少为1。" }),
  unitCost: z.coerce.number().min(0, "单位成本不能为负且为必填项。"),
});


type StockIntakeFormValues = z.infer<typeof stockIntakeFormSchemaBase>;

export function StockIntakeForm() {
  const { products, addBatch, getProductById, getMostRecentUnitCost, batches: allBatches } = useInventory(); // Added allBatches
  const activeProducts = products.filter(p => !p.isArchived);

  const form = useForm<StockIntakeFormValues>({
    resolver: zodResolver(stockIntakeFormSchemaBase),
    defaultValues: {
      productId: "",
      productionDate: null,
      initialQuantity: undefined, 
      unitCost: undefined, 
    },
  });

  const selectedProductId = form.watch("productId");
  const selectedProduct = selectedProductId ? getProductById(selectedProductId) : null;

  const sortedActiveProducts = useMemo(() => {
    const productLastIntakeTime: Record<string, number> = {};

    allBatches.forEach(batch => {
      const batchTime = parseISO(batch.createdAt).getTime();
      if (!productLastIntakeTime[batch.productId] || batchTime > productLastIntakeTime[batch.productId]) {
        productLastIntakeTime[batch.productId] = batchTime;
      }
    });

    return [...activeProducts].sort((a, b) => {
      const timeA = productLastIntakeTime[a.id] || 0; // Products with no batches go to the end
      const timeB = productLastIntakeTime[b.id] || 0;
      return timeB - timeA; // Sort descending
    });
  }, [activeProducts, allBatches]);

  useEffect(() => {
    if (selectedProduct) {
      if (selectedProduct.category !== 'INGREDIENT') {
        form.setValue("productionDate", null);
      }
      const recentCost = getMostRecentUnitCost(selectedProduct.id);
      if (recentCost !== undefined) {
        form.setValue("unitCost", recentCost, { shouldValidate: true, shouldDirty: true });
      } else {
        form.setValue("unitCost", undefined); // Clear unit cost if no recent cost for the new product
      }
    } else {
      form.setValue("unitCost", undefined);
      form.setValue("productionDate", null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct, form.setValue, getMostRecentUnitCost]); // Removed getProductById as it's memoized in context


  function onSubmit(data: StockIntakeFormValues) {
    const product = getProductById(data.productId);
    if (!product) {
        toast({ title: "错误", description: "选择的产品无效。", variant: "destructive" });
        return;
    }

    if (product.category === 'INGREDIENT' && !data.productionDate) {
        form.setError("productionDate", { type: "manual", message: "食材类产品必须提供生产日期。" });
        return;
    }
    
    if (data.unitCost === undefined || data.unitCost < 0) {
      form.setError("unitCost", { type: "manual", message: "单位成本为必填项且不能为负。" });
      return;
    }
     if (data.initialQuantity === undefined || data.initialQuantity <=0) { 
        form.setError("initialQuantity", { type: "manual", message: "接收数量必须大于0。" });
        return;
    }


    addBatch({
      productId: data.productId,
      productionDate: data.productionDate ? data.productionDate.toISOString() : null,
      initialQuantity: data.initialQuantity,
      unitCost: data.unitCost,
    });
    form.reset({
        productId: "",
        productionDate: null,
        initialQuantity: undefined,
        unitCost: undefined,
    });
  }
  
  const placeholderImage = `https://placehold.co/64x64.png?text=${encodeURIComponent(selectedProduct?.name?.substring(0,1) || '?')}`;
  const imageSrc = selectedProduct?.imageUrl || placeholderImage;


  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-6 w-6" />
          记录入库
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
                      {sortedActiveProducts.map((product) => ( // Use sortedActiveProducts here
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.unit}) - {product.category === 'INGREDIENT' ? '食材' : '非食材'}
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
                        类别: {selectedProduct.category === 'INGREDIENT' ? '食材' : '非食材'} | 单位: {selectedProduct.unit}
                    </p>
                </div>
              </div>
            )}


            {selectedProduct && selectedProduct.category === 'INGREDIENT' && (
              <FormField
                control={form.control}
                name="productionDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>生产日期</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value && isValid(new Date(field.value)) ? (
                              format(new Date(field.value), "PPP", { locale: zhCN })
                            ) : (
                              <span>选择一个日期</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          locale={zhCN}
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="initialQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>接收数量 ({selectedProduct?.unit || '单位'})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="例如: 10"
                      min="1"
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : parseFloat(val));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unitCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>单位成本 (¥)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="例如: 15.50"
                      min="0"
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      value={field.value === undefined ? '' : String(field.value)}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? undefined : parseFloat(val));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              <Archive className="mr-2 h-4 w-4" />添加入库批次
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

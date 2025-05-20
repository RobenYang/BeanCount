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
import { type OutflowReason, OUTFLOW_REASONS } from "@/lib/types";
import { PackageMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stockOutflowFormSchema = z.object({
  productId: z.string().min(1, "Product selection is required."),
  quantity: z.coerce.number().positive("Quantity must be a positive number."),
  reason: z.enum(OUTFLOW_REASONS as [OutflowReason, ...OutflowReason[]], {
    required_error: "Reason for outflow is required.",
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
    recordOutflow(data.productId, data.quantity, data.reason, data.notes);
    form.reset();
  }

  const selectedProductId = form.watch("productId");
  const stockDetails = selectedProductId ? getProductStockDetails(selectedProductId) : null;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageMinus className="h-6 w-6" />
          Record Stock Outflow/Consumption
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
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
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
                      Available: {stockDetails.totalQuantity} {products.find(p=>p.id === selectedProductId)?.unit}
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
                  <FormLabel>Quantity to Outflow</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 2" {...field} />
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
                  <FormLabel>Reason for Outflow</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {OUTFLOW_REASONS.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason.replace(/_/g, ' ')}
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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., For event catering, item damaged" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full">
              <PackageMinus className="mr-2 h-4 w-4" /> Record Outflow
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

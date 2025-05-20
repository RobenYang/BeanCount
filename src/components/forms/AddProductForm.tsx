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
import { useInventory } from "@/contexts/InventoryContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

const productFormSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters."),
  category: z.string().min(1, "Category is required."),
  unit: z.string().min(1, "Unit is required (e.g., kg, liter, pcs)."),
  shelfLifeDays: z.coerce.number().int().positive("Shelf life must be a positive number of days."),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export function AddProductForm() {
  const { addProduct } = useInventory();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      category: "",
      unit: "",
      shelfLifeDays: 0,
    },
  });

  function onSubmit(data: ProductFormValues) {
    addProduct(data);
    form.reset();
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-6 w-6" />
          Add New Product
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Arabica Coffee Beans" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Coffee, Dairy, Syrup" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measurement</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., kg, liter, pcs, bottle" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shelfLifeDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standard Shelf Life (days)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 365 for 1 year" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Product
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

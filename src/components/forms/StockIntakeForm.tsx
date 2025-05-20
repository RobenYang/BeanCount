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
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import { CalendarIcon, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stockIntakeFormSchema = z.object({
  productId: z.string().min(1, "Product selection is required."),
  productionDate: z.date({ required_error: "Production date is required." }),
  initialQuantity: z.coerce.number().positive("Quantity must be a positive number."),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
});

type StockIntakeFormValues = z.infer<typeof stockIntakeFormSchema>;

export function StockIntakeForm() {
  const { products, addBatch } = useInventory();
  const activeProducts = products.filter(p => !p.isArchived);

  const form = useForm<StockIntakeFormValues>({
    resolver: zodResolver(stockIntakeFormSchema),
    defaultValues: {
      productId: "",
      initialQuantity: 0,
      unitCost: 0,
    },
  });

  function onSubmit(data: StockIntakeFormValues) {
    const { productId, productionDate, initialQuantity, unitCost } = data;
    addBatch({ 
      productId, 
      productionDate: productionDate.toISOString(), // Convert to ISO string
      initialQuantity, 
      unitCost 
    });
    form.reset();
    // Reset date field specifically if needed, or set a default like new Date()
    form.setValue("productionDate", undefined as any); 
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="h-6 w-6" />
          Record Stock Intake
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="productionDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Production Date</FormLabel>
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
                            format(new Date(field.value), "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
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

            <FormField
              control={form.control}
              name="initialQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity Received</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 10" {...field} />
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
                  <FormLabel>Unit Cost</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="e.g., 15.50" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              <Archive className="mr-2 h-4 w-4" /> Add Stock Batch
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

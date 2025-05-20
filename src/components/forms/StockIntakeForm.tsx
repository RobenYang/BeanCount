
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
import { zhCN } from 'date-fns/locale';
import { CalendarIcon, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stockIntakeFormSchema = z.object({
  productId: z.string().min(1, "必须选择产品。"),
  productionDate: z.date({ required_error: "生产日期为必填项。" }),
  initialQuantity: z.coerce.number().positive("数量必须是正数。"),
  unitCost: z.coerce.number().min(0, "单位成本不能为负。"),
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
      productionDate: productionDate.toISOString(), 
      initialQuantity, 
      unitCost 
    });
    form.reset();
    form.setValue("productionDate", undefined as any); 
  }

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
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <FormLabel>接收数量</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="例如: 10" {...field} />
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
                  <FormLabel>单位成本</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="例如: 15.50" {...field} />
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

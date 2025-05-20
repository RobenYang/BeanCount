
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
  name: z.string().min(2, "产品名称至少需要2个字符。"),
  category: z.string().min(1, "类别为必填项。"),
  unit: z.string().min(1, "单位为必填项 (例如: kg, liter, pcs)。"),
  shelfLifeDays: z.coerce.number().int().positive("保质期必须是正整数天数。"),
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
          添加新产品
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
                  <FormLabel>产品名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: 阿拉比卡咖啡豆" {...field} />
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
                  <FormLabel>类别</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: 咖啡, 乳制品, 糖浆" {...field} />
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
                  <FormLabel>计量单位</FormLabel>
                  <FormControl>
                    <Input placeholder="例如: kg, 升, 个, 瓶" {...field} />
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
                  <FormLabel>标准保质期 (天)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="例如: 365 代表 1 年" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> 添加产品
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

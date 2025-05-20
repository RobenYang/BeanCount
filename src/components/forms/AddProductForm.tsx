
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventory } from "@/contexts/InventoryContext";
import type { ProductCategory } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

const productCategories: { value: ProductCategory; label: string }[] = [
  { value: "INGREDIENT", label: "食材 (有生产/保质期)" },
  { value: "NON_INGREDIENT", label: "非食材 (无生产/保质期)" },
];

const productFormSchema = z.object({
  name: z.string().min(2, "产品名称至少需要2个字符。"),
  category: z.enum(["INGREDIENT", "NON_INGREDIENT"], {
    required_error: "必须选择产品类别。",
  }),
  unit: z.string().min(1, "单位为必填项 (例如: kg, liter, pcs)。"),
  shelfLifeDays: z.coerce.number().int().optional(),
}).superRefine((data, ctx) => {
  if (data.category === "INGREDIENT") {
    if (data.shelfLifeDays === undefined || data.shelfLifeDays === null || data.shelfLifeDays <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "食材的保质期必须是正整数天数。",
        path: ["shelfLifeDays"],
      });
    }
  }
});

type ProductFormValues = z.infer<typeof productFormSchema>;

export function AddProductForm() {
  const { addProduct } = useInventory();
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      category: undefined,
      unit: "",
      shelfLifeDays: undefined,
    },
  });

  const selectedCategory = form.watch("category");

  function onSubmit(data: ProductFormValues) {
    const productDataToAdd = {
      name: data.name,
      category: data.category as ProductCategory,
      unit: data.unit,
      shelfLifeDays: data.category === "INGREDIENT" ? data.shelfLifeDays! : null,
    };
    addProduct(productDataToAdd);
    form.reset({
      name: "",
      category: undefined,
      unit: "",
      shelfLifeDays: undefined,
    });
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
                  <FormLabel>产品类别</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择一个类别" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
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
            {selectedCategory === "INGREDIENT" && (
              <FormField
                control={form.control}
                name="shelfLifeDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标准保质期 (天)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="例如: 365 代表 1 年" 
                        value={field.value === undefined ? '' : String(field.value)}
                        onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === '' ? undefined : parseInt(val, 10));
                        }}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" className="w-full">
              <PlusCircle className="mr-2 h-4 w-4" /> 添加产品
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}


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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useInventory } from "@/contexts/InventoryContext";
import type { AppSettings } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save } from "lucide-react";
import { useEffect } from "react";

const settingsFormSchema = z.object({
  lowStockThreshold: z.coerce
    .number({ invalid_type_error: "必须输入数字。" })
    .int("必须是整数。")
    .min(0, "阈值不能为负。"),
  expiryWarningDays: z.coerce
    .number({ invalid_type_error: "必须输入数字。" })
    .int("必须是整数。")
    .min(0, "天数不能为负。"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function SettingsForm() {
  const { appSettings, updateAppSettings } = useInventory();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      lowStockThreshold: appSettings.lowStockThreshold,
      expiryWarningDays: appSettings.expiryWarningDays,
    },
  });

  useEffect(() => {
    form.reset({
        lowStockThreshold: appSettings.lowStockThreshold,
        expiryWarningDays: appSettings.expiryWarningDays,
    });
  }, [appSettings, form]);


  function onSubmit(data: SettingsFormValues) {
    updateAppSettings(data);
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>预警阈值设置</CardTitle>
        <CardDescription>
          自定义库存不足和临近过期的预警提醒阈值。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="lowStockThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>低库存预警阈值</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="例如: 5" 
                      {...field} 
                      onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    当产品库存数量低于或等于此值时，将标记为低库存。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expiryWarningDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>临近过期预警天数</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="例如: 7" 
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    当食材类产品距离过期日期小于或等于此天数时，将标记为临近过期。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              <Save className="mr-2 h-4 w-4" /> 保存设置
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

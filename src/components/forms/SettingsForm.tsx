
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
import { Save, Palette } from "lucide-react"; // Added Palette icon
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"; // Added RadioGroup
import { Label } from "@/components/ui/label"; // Added Label for RadioGroup items

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
  const [selectedTheme, setSelectedTheme] = useState<string>('light');

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      lowStockThreshold: appSettings.lowStockThreshold,
      expiryWarningDays: appSettings.expiryWarningDays,
    },
  });

  useEffect(() => {
    // Initialize form with current app settings
    form.reset({
        lowStockThreshold: appSettings.lowStockThreshold,
        expiryWarningDays: appSettings.expiryWarningDays,
    });
  }, [appSettings, form]);

  useEffect(() => {
    // Initialize theme selector with stored theme or default
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setSelectedTheme(storedTheme);
      // ThemeInitializer handles initial class application
    } else {
      // If no theme is stored, default to light but don't force set localStorage yet,
      // let ThemeInitializer handle initial state based on its logic.
      // Or, if ThemeInitializer defaults to light if nothing is stored, this can also be 'light'.
      setSelectedTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    setSelectedTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  function onSubmitThresholds(data: SettingsFormValues) {
    updateAppSettings(data);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>预警阈值设置</CardTitle>
          <CardDescription>
            自定义库存不足和临近过期的预警提醒阈值。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitThresholds)} className="space-y-6">
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
                <Save className="mr-2 h-4 w-4" /> 保存阈值设置
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            外观设置
          </CardTitle>
          <CardDescription>
            选择应用界面的显示模式。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            onValueChange={handleThemeChange}
            value={selectedTheme}
            className="space-y-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="theme-light" />
              <Label htmlFor="theme-light" className="cursor-pointer">浅色模式</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dark" id="theme-dark" />
              <Label htmlFor="theme-dark" className="cursor-pointer">深色模式</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}

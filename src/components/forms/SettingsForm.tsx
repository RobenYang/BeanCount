
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
import { Save, Palette, Loader2, AlertTriangle, Download, Trash2, BookText } from "lucide-react";
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useErrorLogger } from "@/contexts/ErrorContext"; // Import useErrorLogger
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";


const settingsFormSchema = z.object({
  expiryWarningDays: z.coerce
    .number({ invalid_type_error: "必须输入数字。" })
    .int("必须是整数。")
    .min(0, "天数不能为负。"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// Removed DEFAULT_APP_SETTINGS as it's now handled by InventoryContext's initial state or API fetch
// const DEFAULT_APP_SETTINGS: AppSettings = { expiryWarningDays: 7 };

export function SettingsForm() {
  const { appSettings, updateAppSettings, isLoadingSettings } = useInventory();
  const { errorLogs, exportErrorLogs, clearErrorLogs } = useErrorLogger(); // Get error log functions
  const { currentUser } = useAuth();
  const [selectedTheme, setSelectedTheme] = useState<string>('light');

  const settingsHookForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: { 
      expiryWarningDays: appSettings?.expiryWarningDays || 7, // Initialize with context or a fallback
    },
  });

  useEffect(() => {
    if (!isLoadingSettings && appSettings) {
      settingsHookForm.reset({
          expiryWarningDays: appSettings.expiryWarningDays,
      });
    }
  }, [appSettings, isLoadingSettings, settingsHookForm]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setSelectedTheme(storedTheme);
      if (storedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      setSelectedTheme(currentTheme);
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

  async function onSubmitSettings(data: SettingsFormValues) {
    await updateAppSettings(data);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>预警阈值设置</CardTitle>
          <CardDescription>
            自定义临近过期的预警提醒阈值。低库存阈值在每个产品添加或编辑时单独设置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSettings ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">正在加载设置...</p>
            </div>
          ) : (
            <Form {...settingsHookForm}>
              <form onSubmit={settingsHookForm.handleSubmit(onSubmitSettings)} className="space-y-6">
                <FormField
                  control={settingsHookForm.control}
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
                <Button type="submit" className="w-full" disabled={settingsHookForm.formState.isSubmitting}>
                  {settingsHookForm.formState.isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                   保存常规设置
                </Button>
              </form>
            </Form>
          )}
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

      {currentUser?.isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              错误日志与诊断
            </CardTitle>
            <CardDescription>
              查看应用运行时捕获到的客户端错误，并可导出用于诊断。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                <div>
                    <p className="text-sm font-medium">已记录错误数量</p>
                    <p className="text-2xl font-bold">{errorLogs.length}</p>
                </div>
                <BookText className="w-8 h-8 text-muted-foreground" />
            </div>
            
            {errorLogs.length > 0 && (
              <ScrollArea className="h-64 w-full rounded-md border p-3">
                <div className="space-y-3">
                  {errorLogs.slice().reverse().map(log => ( // Show newest first
                    <div key={log.id} className="p-2 border rounded-md bg-background text-xs">
                      <p><strong>时间:</strong> {formatISO(new Date(log.timestamp), { representation: 'complete' })}</p>
                      <p><strong>类型:</strong> {log.errorType}</p>
                      <p><strong>消息:</strong> {log.message}</p>
                      {log.url && <p><strong>URL:</strong> {log.url}</p>}
                      {log.stack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground">堆栈信息</summary>
                          <pre className="mt-1 whitespace-pre-wrap text-muted-foreground/80 bg-muted p-1 rounded text-[0.7rem] leading-tight">{log.stack}</pre>
                        </details>
                      )}
                       {log.componentStack && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground">组件堆栈</summary>
                          <pre className="mt-1 whitespace-pre-wrap text-muted-foreground/80 bg-muted p-1 rounded text-[0.7rem] leading-tight">{log.componentStack}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            {errorLogs.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无错误日志记录。</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button onClick={exportErrorLogs} variant="outline" className="flex-1" disabled={errorLogs.length === 0}>
                <Download className="mr-2 h-4 w-4" /> 导出错误日志
              </Button>
              <Button onClick={clearErrorLogs} variant="destructive" className="flex-1" disabled={errorLogs.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" /> 清除错误日志
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

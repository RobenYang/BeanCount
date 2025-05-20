
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
import { Save, Palette } from "lucide-react"; // Removed Users, Trash2
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
// import { useAuth } from '@/contexts/AuthContext'; // No longer needed for user management UI
// import { toast } from "@/hooks/use-toast"; // No longer needed for user management UI

const settingsFormSchema = z.object({
  expiryWarningDays: z.coerce
    .number({ invalid_type_error: "必须输入数字。" })
    .int("必须是整数。")
    .min(0, "天数不能为负。"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

// addUserFormSchema and AddUserFormValues are removed

export function SettingsForm() {
  const { appSettings, updateAppSettings } = useInventory();
  // const auth = useAuth(); // No longer needed for user management UI
  const [selectedTheme, setSelectedTheme] = useState<string>('light');

  const settingsHookForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      expiryWarningDays: appSettings.expiryWarningDays,
    },
  });

  // addUserHookForm is removed

  useEffect(() => {
    settingsHookForm.reset({
        expiryWarningDays: appSettings.expiryWarningDays,
    });
  }, [appSettings, settingsHookForm]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setSelectedTheme(storedTheme);
    } else {
      // Fallback to checking class on documentElement if no theme is stored
      // This part might be redundant if ThemeInitializer already handles it well,
      // but it ensures the radio buttons reflect the current theme.
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

  function onSubmitSettings(data: SettingsFormValues) {
    updateAppSettings(data);
  }

  // handleAddUser and handleDeleteUser functions are removed

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
              <Button type="submit" className="w-full">
                <Save className="mr-2 h-4 w-4" /> 保存常规设置
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

      {/* Account Management Card is removed */}
    </div>
  );
}

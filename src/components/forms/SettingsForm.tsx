
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
import { Save, Palette, Users, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { toast } from "@/hooks/use-toast";

const settingsFormSchema = z.object({
  expiryWarningDays: z.coerce
    .number({ invalid_type_error: "必须输入数字。" })
    .int("必须是整数。")
    .min(0, "天数不能为负。"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

const addUserFormSchema = z.object({
    newUsername: z.string().min(3, "用户名至少需要3个字符。"),
    newPassword: z.string().min(6, "密码至少需要6个字符。"),
});
type AddUserFormValues = z.infer<typeof addUserFormSchema>;


export function SettingsForm() {
  const { appSettings, updateAppSettings } = useInventory();
  const auth = useAuth();
  const [selectedTheme, setSelectedTheme] = useState<string>('light');

  const settingsHookForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      expiryWarningDays: appSettings.expiryWarningDays,
    },
  });

  const addUserHookForm = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserFormSchema),
    defaultValues: {
        newUsername: "",
        newPassword: "",
    }
  });

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

  const handleAddUser = (data: AddUserFormValues) => {
    auth.addUser(data.newUsername, data.newPassword);
    addUserHookForm.reset();
  };

  const handleDeleteUser = (usernameToDelete: string) => {
    if (usernameToDelete === auth.currentUser?.username && auth.currentUser?.isSuperAdmin) {
      toast({ title: "错误", description: "不能删除当前登录的超级管理员账户。", variant: "destructive"});
      return;
    }
    auth.deleteUser(usernameToDelete);
  };


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

      {auth.currentUser?.isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />账户管理</CardTitle>
            <CardDescription>添加或删除用户账户。(仅超级管理员可见)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">现有用户列表</h3>
              {auth.users.length > 0 ? (
                <ul className="space-y-2">
                  {auth.users.map(user => (
                    <li key={user.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/30">
                      <span className="font-medium">{user.username} {user.isSuperAdmin ? <span className="text-xs text-primary font-semibold">(超级管理员)</span> : ''}</span>
                      {!user.isSuperAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.username)} title={`删除用户 ${user.username}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">暂无其他用户。</p>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium mb-4 pt-4 border-t">添加新用户</h3>
              <Form {...addUserHookForm}>
                <form onSubmit={addUserHookForm.handleSubmit(handleAddUser)} className="space-y-4">
                    <FormField
                        control={addUserHookForm.control}
                        name="newUsername"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>新用户名</FormLabel>
                                <FormControl>
                                    <Input {...field} placeholder="输入用户名" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={addUserHookForm.control}
                        name="newPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>新密码</FormLabel>
                                <FormControl>
                                    <Input type="password" {...field} placeholder="输入密码" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                  <Button type="submit" className="w-full">
                    <Users className="mr-2 h-4 w-4" /> 添加用户
                  </Button>
                </form>
              </Form>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

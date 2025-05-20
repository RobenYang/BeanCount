
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Coffee, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if already authenticated and not loading
    if (!auth.isLoading && auth.isAuthenticated) {
      router.replace('/'); // Use replace to not add login to history
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
        auth.toast({ title: "错误", description: "请输入用户名和密码。", variant: "destructive"});
        return;
    }
    setIsLoggingIn(true);
    try {
      await auth.login(username, password);
      // Redirect is handled within auth.login on success, or by the useEffect above if already logged in
    } catch (error) {
      // Error toast is handled within auth.login
      setIsLoggingIn(false);
    }
  };
  
  // If we are still loading auth state, or if we are authenticated and waiting for redirect,
  // show a loader or nothing to prevent rendering the form.
  if (auth.isLoading || (!auth.isLoading && auth.isAuthenticated)) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Coffee className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">傲慢与偏见咖啡庄园</CardTitle>
          <CardDescription>请输入您的凭据以登录库存管理系统。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoggingIn}
                placeholder=""
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoggingIn}
                placeholder=""
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-xs text-center block">
            <p className="text-muted-foreground">
                安全提示：此为原型系统，请勿使用真实敏感密码。
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}


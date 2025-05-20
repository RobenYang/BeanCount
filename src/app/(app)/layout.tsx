
"use client";
import { InventoryProvider } from '@/contexts/InventoryContext';
import { AppLogo } from '@/components/AppLogo';
import { MainNav } from '@/components/MainNav';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, LogOut } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/login');
    }
  }, [auth.isAuthenticated, auth.isLoading, router]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <InventoryProvider>
      <SidebarProvider defaultOpen>
        <div className="flex min-h-screen w-full">
          <Sidebar collapsible="icon" className="border-r">
            <SidebarHeader className="p-4">
              <AppLogo />
            </SidebarHeader>
            <ScrollArea className="flex-1">
              <SidebarContent>
                <MainNav />
              </SidebarContent>
            </ScrollArea>
            <SidebarFooter className="p-2 mt-auto border-t">
              <Button variant="ghost" className="w-full justify-start text-sm" onClick={auth.logout} title="登出">
                <LogOut className="mr-2 h-4 w-4" />
                登出 ({auth.currentUser?.username})
              </Button>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex flex-col">
            <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4 md:hidden">
                <SidebarTrigger className="md:hidden" />
                <AppLogo />
            </header>
            <ScrollArea className="flex-1">
              <main className="p-4 sm:p-6">
                {children}
              </main>
            </ScrollArea>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </InventoryProvider>
  );
}

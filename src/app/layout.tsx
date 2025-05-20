
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed GeistMono import
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeInitializer } from '@/components/ThemeInitializer';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorProvider } from '@/contexts/ErrorContext'; // Import ErrorProvider
import ErrorBoundary from '@/components/ErrorBoundary'; // Import ErrorBoundary


const geistSans = GeistSans;
// Removed geistMono constant

export const metadata: Metadata = {
  title: '傲慢与偏见咖啡庄园 - 咖啡店库存管理',
  description: '轻松管理您的咖啡店库存。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <ErrorProvider> {/* Wrap AuthProvider (and thus the whole app) with ErrorProvider */}
          <AuthProvider>
            <ThemeInitializer />
            <ErrorBoundary> {/* Wrap children with ErrorBoundary */}
              {children}
            </ErrorBoundary>
            <Toaster />
          </AuthProvider>
        </ErrorProvider>
      </body>
    </html>
  );
}

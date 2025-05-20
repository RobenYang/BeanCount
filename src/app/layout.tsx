import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed GeistMono import
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const geistSans = GeistSans;
// Removed geistMono constant

export const metadata: Metadata = {
  title: '豆豆账本 - 咖啡店库存管理',
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}

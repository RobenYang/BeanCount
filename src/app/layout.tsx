import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
// Removed GeistMono import
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const geistSans = GeistSans;
// Removed geistMono constant

export const metadata: Metadata = {
  title: 'Bean Counter - Coffee Shop Inventory',
  description: 'Manage your coffee shop inventory with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

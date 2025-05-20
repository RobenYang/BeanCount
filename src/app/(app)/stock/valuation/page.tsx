
"use client";
// This file is planned for deletion.
// The functionality is being moved to /stock-analysis/page.tsx
// Keeping it temporarily to avoid build errors during transition if MainNav is not updated first.

import { BarChart3 } from "lucide-react";

export default function DeprecatedStockValuationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <BarChart3 className="h-8 w-8" />
        此页面已移动
      </h1>
      <p>库存统计功能已更新为库存分析，请访问新的 "库存分析" 页面。</p>
    </div>
  );
}

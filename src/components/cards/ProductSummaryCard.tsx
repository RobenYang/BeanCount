
"use client";

import type { Product, Batch, ProductStockAnalysis } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { zhCN } from 'date-fns/locale';
import NextImage from "next/image";
import { Button } from "../ui/button";
import { Archive, Package, AlertTriangle, Hourglass } from "lucide-react"; // Added Hourglass
import { useState } from "react";
import { ImagePreviewModal } from "@/components/modals/ImagePreviewModal";
import { useInventory } from "@/contexts/InventoryContext";
import { cn } from "@/lib/utils";

interface ProductSummaryCardProps {
  product: Product;
  batches: Batch[];
  totalQuantity: number;
  onArchiveProduct?: (productId: string) => void;
  analysisData?: Pick<ProductStockAnalysis, 'avgDailyConsumption' | 'predictedDepletionDate' | 'daysToDepletion'> | null;
}

function formatProductCategoryForDisplay(category: Product['category']): string {
    if (category === 'INGREDIENT') return '食材';
    if (category === 'NON_INGREDIENT') return '非食材';
    return category;
}


export function ProductSummaryCard({ product, batches, totalQuantity, onArchiveProduct, analysisData }: ProductSummaryCardProps) {
  const { appSettings } = useInventory();

  const isDepletingSoon = analysisData?.daysToDepletion !== undefined &&
                          analysisData.daysToDepletion !== Infinity &&
                          analysisData.daysToDepletion <= appSettings.depletionWarningDays;

  const isNearingExpiry = product.category === 'INGREDIENT' &&
                          batches.some(b => b.expiryDate &&
                                            differenceInDays(parseISO(b.expiryDate), new Date()) >= 0 &&
                                            differenceInDays(parseISO(b.expiryDate), new Date()) <= appSettings.expiryWarningDays);

  const isIngredient = product.category === 'INGREDIENT';
  const placeholderImage = `https://placehold.co/64x64.png?text=${encodeURIComponent(product.name.substring(0,1))}`;
  const imageSrc = product.imageUrl || placeholderImage;

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageClick = () => {
    if (product.imageUrl) {
      setIsModalOpen(true);
    }
  };


  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {product.name}
              </CardTitle>
              <CardDescription>{formatProductCategoryForDisplay(product.category)} - 单位: {product.unit}</CardDescription>
            </div>
            <div className="flex gap-2">
              {onArchiveProduct && !product.isArchived && (
                 <Button variant="ghost" size="icon" onClick={() => onArchiveProduct(product.id)} title="归档产品">
                   <Archive className="h-4 w-4" />
                 </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <div
              className={`rounded-md overflow-hidden ${product.imageUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={handleImageClick}
              role={product.imageUrl ? "button" : undefined}
              tabIndex={product.imageUrl ? 0 : undefined}
              onKeyDown={product.imageUrl ? (e) => (e.key === 'Enter' || e.key === ' ') && handleImageClick() : undefined}
              aria-label={product.imageUrl ? `查看 ${product.name} 的大图` : product.name}
            >
              <NextImage
                src={imageSrc}
                alt={product.name}
                width={48}
                height={48}
                className="object-cover aspect-square"
                data-ai-hint="product item"
              />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalQuantity} <span className="text-sm font-normal text-muted-foreground">{product.unit}</span></p>
              <p className="text-xs text-muted-foreground">总库存</p>
            </div>
          </div>

        </CardHeader>
        <CardContent className="pt-2 pb-2 text-xs text-muted-foreground min-h-[4rem]">
          {analysisData ? (
            <>
              <p>日均消耗 (上周): {analysisData.avgDailyConsumption.toFixed(2)} {product.unit}</p>
              <p className={cn(
                  "font-medium",
                  isDepletingSoon && "text-destructive font-bold"
                 )}
              >
                预计耗尽: {' '}
                {analysisData.predictedDepletionDate === "已耗尽" || analysisData.predictedDepletionDate === "无消耗"
                  ? analysisData.predictedDepletionDate
                  : format(parseISO(analysisData.predictedDepletionDate), "yyyy-MM-dd", { locale: zhCN })}
                {analysisData.daysToDepletion !== undefined && analysisData.daysToDepletion !== Infinity && analysisData.daysToDepletion >= 0 && analysisData.predictedDepletionDate !== "已耗尽" && (
                  <span className="ml-1">({analysisData.daysToDepletion}天)</span>
                )}
              </p>
            </>
          ) : (
            <p>消耗分析数据不可用。</p>
          )}
        </CardContent>
        <CardFooter className="pt-2 space-x-2">
          {isDepletingSoon && (
            <Badge variant="destructive" className="items-center">
              <Hourglass className="mr-1 h-3 w-3" /> 即将耗尽 (≤{appSettings.depletionWarningDays}天)
            </Badge>
          )}
          {isNearingExpiry && !isDepletingSoon && ( // Show only if not already depleting soon to avoid badge clutter
            <Badge variant="outline" className="border-orange-500 text-orange-600 items-center">
              <AlertTriangle className="mr-1 h-3 w-3" /> 临近过期
            </Badge>
          )}
        </CardFooter>
      </Card>
      {isModalOpen && product.imageUrl && (
        <ImagePreviewModal
          imageUrl={product.imageUrl}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          productName={product.name}
        />
      )}
    </>
  );
}

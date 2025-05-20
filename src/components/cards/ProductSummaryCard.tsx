
"use client";

import type { Product, Batch } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { zhCN } from 'date-fns/locale';
import NextImage from "next/image"; 
import { Button } from "../ui/button";
import { Archive, Package } from "lucide-react";
import { useState } from "react"; 
import { ImagePreviewModal } from "@/components/modals/ImagePreviewModal"; 
import { useInventory } from "@/contexts/InventoryContext";

interface ProductSummaryCardProps {
  product: Product;
  batches: Batch[]; // Still needed for nearing expiry badge logic
  totalQuantity: number;
  onArchiveProduct?: (productId: string) => void;
}

function formatProductCategoryForDisplay(category: Product['category']): string {
    if (category === 'INGREDIENT') return '食材';
    if (category === 'NON_INGREDIENT') return '非食材';
    return category; 
}


export function ProductSummaryCard({ product, batches, totalQuantity, onArchiveProduct }: ProductSummaryCardProps) {
  const { appSettings } = useInventory(); 
  const isLowStock = totalQuantity < product.lowStockThreshold;
  
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
              <CardTitle className="text-lg flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Package className="h-5 w-5 text-primary" />
                {product.name}
              </CardTitle>
              <CardDescription>{formatProductCategoryForDisplay(product.category)} - 单位: {product.unit} (阈值: {product.lowStockThreshold})</CardDescription>
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
        <CardContent className="pt-0 pb-2"> {/* Removed flex-grow and the inner div with min-h */}
           {/* This content area is now minimal. Badges are in the footer. */}
        </CardContent>
        <CardFooter className="pt-2">
          {isLowStock && <Badge variant="destructive">低库存 (阈值: {product.lowStockThreshold})</Badge>}
          {isIngredient && batches.some(b => b.expiryDate && differenceInDays(parseISO(b.expiryDate), new Date()) <= appSettings.expiryWarningDays && differenceInDays(parseISO(b.expiryDate), new Date()) >= 0) && !isLowStock && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-600">临近过期</Badge>
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

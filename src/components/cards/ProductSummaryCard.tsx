
"use client";

import type { Product, Batch } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import NextImage from "next/image"; 
import { Button } from "../ui/button";
import { Archive, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react"; 
import { ImagePreviewModal } from "@/components/modals/ImagePreviewModal"; 
import { useInventory } from "@/contexts/InventoryContext";

interface ProductSummaryCardProps {
  product: Product;
  batches: Batch[];
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
  const isLowStock = totalQuantity < product.lowStockThreshold; // Use product-specific threshold
  
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
              <CardTitle className="text-xl flex items-center gap-2">
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
        <CardContent className="flex-grow pt-0 pb-2">
          {batches.length > 0 ? (
            <ScrollArea className="h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isIngredient && <TableHead className="text-xs">生产日期</TableHead>}
                    {isIngredient && <TableHead className="text-xs">过期日期</TableHead>}
                    {!isIngredient && <TableHead className="text-xs">入库/生产日期</TableHead>}
                    <TableHead className="text-xs text-right">数量</TableHead>
                    <TableHead className="text-xs text-right">成本/单位</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.sort((a,b) => (a.expiryDate && b.expiryDate ? new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime() : (a.productionDate && b.productionDate && !a.expiryDate && !b.expiryDate ? new Date(a.productionDate).getTime() - new Date(b.productionDate).getTime() : (a.createdAt && b.createdAt ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() : 0 )))).map((batch) => {
                    let expiryBadgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
                    let daysToExpiryText = "";
                    const displayDate = !isIngredient ? batch.productionDate || batch.createdAt : batch.productionDate;


                    if (isIngredient && batch.expiryDate) {
                      const expiryDate = parseISO(batch.expiryDate);
                      const daysToExpiry = differenceInDays(expiryDate, new Date());
                      if (daysToExpiry < 0) {
                          expiryBadgeVariant = "destructive";
                          daysToExpiryText = ` (已过期 ${Math.abs(daysToExpiry)}天)`;
                      } else {
                          daysToExpiryText = ` (剩 ${daysToExpiry}天)`;
                          if (daysToExpiry <= appSettings.expiryWarningDays) expiryBadgeVariant = "outline";
                      }
                    }

                    return (
                      <TableRow key={batch.id}>
                         {isIngredient && (
                          <TableCell className="py-1.5 text-xs">
                            {batch.productionDate ? format(parseISO(batch.productionDate), "yy-MM-dd", { locale: zhCN }) : 'N/A'}
                          </TableCell>
                         )}
                        {isIngredient && (
                          <TableCell className="py-1.5 text-xs">
                            {batch.expiryDate ? (
                              <Badge variant={expiryBadgeVariant} className="text-xs whitespace-nowrap">
                                {format(parseISO(batch.expiryDate), "yy-MM-dd", { locale: zhCN })}
                                {daysToExpiryText}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        )}
                         {!isIngredient && (
                          <TableCell className="py-1.5 text-xs">
                            {displayDate ? format(parseISO(displayDate), "yyyy-MM-dd", { locale: zhCN }) : 'N/A'}
                          </TableCell>
                         )}
                        <TableCell className="py-1.5 text-right text-sm">{batch.currentQuantity}</TableCell>
                        <TableCell className="py-1.5 text-right text-sm">¥{batch.unitCost.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <p>暂无批次库存。</p>
            </div>
          )}
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

"use client";

import type { Product, Batch } from "@/lib/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { Button } from "../ui/button";
import { Archive, Edit, Package } from "lucide-react";
import Link from "next/link";

interface ProductSummaryCardProps {
  product: Product;
  batches: Batch[];
  totalQuantity: number;
  onArchiveProduct?: (productId: string) => void;
}

export function ProductSummaryCard({ product, batches, totalQuantity, onArchiveProduct }: ProductSummaryCardProps) {
  const isLowStock = totalQuantity < 5; // Example low stock threshold
  const nearingExpiryThresholdDays = 7;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> 
              {product.name}
            </CardTitle>
            <CardDescription>{product.category} - Unit: {product.unit}</CardDescription>
          </div>
          <div className="flex gap-2">
            {/* <Button variant="ghost" size="icon" asChild>
              <Link href={`/products/edit/${product.id}`} title="Edit Product">
                <Edit className="h-4 w-4" />
              </Link>
            </Button> */}
            {onArchiveProduct && !product.isArchived && (
               <Button variant="ghost" size="icon" onClick={() => onArchiveProduct(product.id)} title="Archive Product">
                 <Archive className="h-4 w-4" />
               </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 pt-2">
          <Image 
            src={`https://placehold.co/64x64.png?text=${product.name.substring(0,1)}`} 
            alt={product.name}
            width={48}
            height={48}
            className="rounded-md aspect-square object-cover"
            data-ai-hint="product item"
          />
          <div>
            <p className="text-2xl font-bold">{totalQuantity} <span className="text-sm font-normal text-muted-foreground">{product.unit}(s)</span></p>
            <p className="text-xs text-muted-foreground">Total In Stock</p>
          </div>
        </div>
       
      </CardHeader>
      <CardContent className="flex-grow pt-0 pb-2">
        {batches.length > 0 ? (
          <ScrollArea className="h-48">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Expiry</TableHead>
                  <TableHead className="text-xs text-right">Qty</TableHead>
                  <TableHead className="text-xs text-right">Cost/Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.sort((a,b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()).map((batch) => {
                  const expiryDate = parseISO(batch.expiryDate);
                  const daysToExpiry = differenceInDays(expiryDate, new Date());
                  let expiryBadgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
                  if (daysToExpiry < 0) expiryBadgeVariant = "destructive";
                  else if (daysToExpiry <= nearingExpiryThresholdDays) expiryBadgeVariant = "outline";
                  
                  return (
                    <TableRow key={batch.id}>
                      <TableCell className="py-1.5">
                        <Badge variant={expiryBadgeVariant} className="text-xs">
                          {format(expiryDate, "dd MMM yyyy")}
                          {daysToExpiry < 0 ? ` (Expired ${Math.abs(daysToExpiry)}d ago)` : ` (${daysToExpiry}d left)`}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-sm">{batch.currentQuantity}</TableCell>
                      <TableCell className="py-1.5 text-right text-sm">${batch.unitCost.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <p>No batches in stock.</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-2">
        {isLowStock && <Badge variant="destructive">Low Stock</Badge>}
        {batches.some(b => differenceInDays(parseISO(b.expiryDate), new Date()) <= nearingExpiryThresholdDays && differenceInDays(parseISO(b.expiryDate), new Date()) >= 0) && !isLowStock && (
          <Badge variant="outline" className="border-yellow-500 text-yellow-600">Nearing Expiry</Badge>
        )}
      </CardFooter>
    </Card>
  );
}

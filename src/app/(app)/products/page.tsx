
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Product, Batch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Archive, Edit, Undo, PackageSearch, Package, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { format, parseISO, differenceInDays } from "date-fns";
import { zhCN } from 'date-fns/locale';
import Image from "next/image";
import { useState, Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProductBatchDetails({ batches, unit }: { batches: Batch[], unit: string }) {
  if (batches.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">该产品暂无活动批次信息。</p>;
  }

  const nearingExpiryThresholdDays = 7;

  return (
    <div className="p-4 bg-muted/50 rounded-md">
      <h4 className="text-md font-semibold mb-2">批次详情</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">生产日期</TableHead>
            <TableHead className="text-xs">过期日期</TableHead>
            <TableHead className="text-xs text-right">初始数量</TableHead>
            <TableHead className="text-xs text-right">当前数量</TableHead>
            <TableHead className="text-xs text-right">单位成本 (¥)</TableHead>
            <TableHead className="text-xs text-right">批次总价值 (¥)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.sort((a,b) => parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime()).map((batch) => {
            const expiryDate = parseISO(batch.expiryDate);
            const daysToExpiry = differenceInDays(expiryDate, new Date());
            let expiryBadgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
            if (daysToExpiry < 0) expiryBadgeVariant = "destructive";
            else if (daysToExpiry <= nearingExpiryThresholdDays) expiryBadgeVariant = "outline";

            return (
              <TableRow key={batch.id}>
                <TableCell className="text-xs">{format(parseISO(batch.productionDate), "yyyy-MM-dd")}</TableCell>
                <TableCell className="text-xs">
                  <Badge variant={expiryBadgeVariant} className="text-xs whitespace-nowrap">
                    {format(expiryDate, "yyyy-MM-dd")}
                    {daysToExpiry < 0 ? ` (已过期 ${Math.abs(daysToExpiry)}天)` : ` (剩 ${daysToExpiry}天)`}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-right">{batch.initialQuantity} {unit}</TableCell>
                <TableCell className="text-xs text-right">{batch.currentQuantity} {unit}</TableCell>
                <TableCell className="text-xs text-right">{batch.unitCost.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right">{(batch.currentQuantity * batch.unitCost).toFixed(2)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function ProductRow({ product, onArchive, onUnarchive }: { product: Product, onArchive: (id: string) => void, onUnarchive: (id: string) => void }) {
  const { getProductStockDetails } = useInventory();
  const { totalQuantity, totalValue, batches } = getProductStockDetails(product.id);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Fragment>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="mr-2 h-8 w-8">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Image 
              src={`https://placehold.co/64x64.png?text=${product.name.substring(0,1)}`}
              alt={product.name}
              width={40}
              height={40}
              className="rounded-md aspect-square object-cover"
              data-ai-hint="product item"
            />
            <div>
              <div className="font-medium">{product.name}</div>
              <div className="text-xs text-muted-foreground">{product.category}</div>
            </div>
          </div>
        </TableCell>
        <TableCell>{product.unit}</TableCell>
        <TableCell>{product.shelfLifeDays} 天</TableCell>
        <TableCell className="text-right">{totalQuantity}</TableCell>
        <TableCell className="text-right">¥{totalValue.toFixed(2)}</TableCell>
        <TableCell>{format(parseISO(product.createdAt), "yyyy年MM月dd日")}</TableCell>
        <TableCell className="text-right">
          {product.isArchived ? (
            <Button variant="ghost" size="sm" onClick={() => onUnarchive(product.id)} title="取消归档产品">
              <Undo className="mr-2 h-4 w-4" /> 取消归档
            </Button>
          ) : (
            <>
              {/* <Button variant="ghost" size="icon" asChild title="编辑产品">
                <Link href={`/products/edit/${product.id}`}>
                  <Edit className="h-4 w-4" />
                </Link>
              </Button> */}
              <Button variant="ghost" size="icon" onClick={() => onArchive(product.id)} title="归档产品">
                <Archive className="h-4 w-4" />
              </Button>
            </>
          )}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={8}> {/* Adjusted colSpan to match number of columns */}
            <ProductBatchDetails batches={batches} unit={product.unit} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

export default function ProductsPage() {
  const { products, archiveProduct, unarchiveProduct } = useInventory();
  const [activeTab, setActiveTab] = useState("active");

  const activeProducts = products.filter(p => !p.isArchived);
  const archivedProducts = products.filter(p => p.isArchived);

  const productsToDisplay = activeTab === "active" ? activeProducts : archivedProducts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-8 w-8" /> 产品管理</h1>
        <Button asChild>
          <Link href="/products/add">
            <PlusCircle className="mr-2 h-4 w-4" /> 添加新产品
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">活动 ({activeProducts.length})</TabsTrigger>
          <TabsTrigger value="archived">已归档 ({archivedProducts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {productsToDisplay.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead> {/* For expand icon */}
                    <TableHead>名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>保质期</TableHead>
                    <TableHead className="text-right">库存数量</TableHead>
                    <TableHead className="text-right">库存总价值</TableHead>
                    <TableHead>创建日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToDisplay.map((product) => (
                    <ProductRow key={product.id} product={product} onArchive={archiveProduct} onUnarchive={unarchiveProduct} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
             <Card>
              <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[200px] text-center">
                <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">无活动产品</h3>
                <p className="text-muted-foreground mb-4">
                  添加一些产品开始吧！
                </p>
                <Button asChild>
                  <Link href="/products/add">添加新产品</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="archived">
           {productsToDisplay.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead> {/* For expand icon */}
                    <TableHead>名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead>保质期</TableHead>
                    <TableHead className="text-right">库存数量</TableHead>
                     <TableHead className="text-right">库存总价值</TableHead>
                    <TableHead>创建日期</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToDisplay.map((product) => (
                    <ProductRow key={product.id} product={product} onArchive={archiveProduct} onUnarchive={unarchiveProduct} />
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
             <Card>
              <CardContent className="pt-6 flex flex-col items-center justify-center min-h-[200px] text-center">
                <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold">无已归档产品</h3>
                <p className="text-muted-foreground mb-4">
                  您归档的产品将显示在此处。
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


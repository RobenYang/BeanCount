
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Archive, Edit, Undo, PackageSearch, Package, DollarSign } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProductRow({ product, onArchive, onUnarchive }: { product: Product, onArchive: (id: string) => void, onUnarchive: (id: string) => void }) {
  const { getProductStockDetails } = useInventory();
  const { totalQuantity, totalValue } = getProductStockDetails(product.id);

  return (
    <TableRow>
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
      <TableCell className="text-right">${totalValue.toFixed(2)}</TableCell>
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
                  {activeTab === "active" ? "添加一些产品开始吧！" : "尚无产品被归档。"}
                </p>
                {activeTab === "active" && (
                  <Button asChild>
                    <Link href="/products/add">添加新产品</Link>
                  </Button>
                )}
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

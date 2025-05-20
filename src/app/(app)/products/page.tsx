"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Archive, Edit, Undo, PackageSearch, Package } from "lucide-react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProductRow({ product, onArchive, onUnarchive }: { product: Product, onArchive: (id: string) => void, onUnarchive: (id: string) => void }) {
  const { getProductStockDetails } = useInventory();
  const { totalQuantity } = getProductStockDetails(product.id);

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
      <TableCell>{product.shelfLifeDays} days</TableCell>
      <TableCell className="text-right">{totalQuantity}</TableCell>
      <TableCell>{format(parseISO(product.createdAt), "dd MMM yyyy")}</TableCell>
      <TableCell className="text-right">
        {product.isArchived ? (
          <Button variant="ghost" size="sm" onClick={() => onUnarchive(product.id)} title="Unarchive Product">
            <Undo className="mr-2 h-4 w-4" /> Unarchive
          </Button>
        ) : (
          <>
            {/* <Button variant="ghost" size="icon" asChild title="Edit Product">
              <Link href={`/products/edit/${product.id}`}>
                <Edit className="h-4 w-4" />
              </Link>
            </Button> */}
            <Button variant="ghost" size="icon" onClick={() => onArchive(product.id)} title="Archive Product">
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
        <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-8 w-8" /> Product Management</h1>
        <Button asChild>
          <Link href="/products/add">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Active ({activeProducts.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedProducts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {productsToDisplay.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Shelf Life</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                <h3 className="text-xl font-semibold">No Active Products</h3>
                <p className="text-muted-foreground mb-4">
                  {activeTab === "active" ? "Add some products to get started!" : "No products have been archived yet."}
                </p>
                {activeTab === "active" && (
                  <Button asChild>
                    <Link href="/products/add">Add New Product</Link>
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
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Shelf Life</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
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
                <h3 className="text-xl font-semibold">No Archived Products</h3>
                <p className="text-muted-foreground mb-4">
                  Products you archive will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

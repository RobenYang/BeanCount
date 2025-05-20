
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Product, Batch, ProductCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Archive, Undo, PackageSearch, Package, ChevronDown, ChevronRight, Settings, Pencil } from "lucide-react";
import Link from "next/link";
import { format, parseISO, differenceInDays } from "date-fns";
import { zhCN } from 'date-fns/locale';
import NextImage from "next/image";
import { useState, Fragment } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePreviewModal } from "@/components/modals/ImagePreviewModal";
import { EditProductForm } from "@/components/forms/EditProductForm";

function formatProductCategory(category: ProductCategory): string {
  switch (category) {
    case "INGREDIENT":
      return "食材";
    case "NON_INGREDIENT":
      return "非食材";
    default:
      return category;
  }
}

function ProductBatchDetails({ batches, unit, productCategory, expiryWarningDays }: { batches: Batch[], unit: string, productCategory: ProductCategory, expiryWarningDays: number }) {
  if (batches.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">该产品暂无活动批次信息。</p>;
  }

  return (
    <div className="p-4 bg-muted/50 rounded-md">
      <h4 className="text-md font-semibold mb-2">批次详情</h4>
      <Table>
        <TableHeader>
          <TableRow>
            {productCategory === 'INGREDIENT' && <TableHead className="text-xs">生产日期</TableHead>}
            {productCategory === 'INGREDIENT' && <TableHead className="text-xs">过期日期</TableHead>}
            {productCategory === 'NON_INGREDIENT' && <TableHead className="text-xs">入库/生产日期</TableHead>}
            <TableHead className="text-xs text-right">初始数量</TableHead>
            <TableHead className="text-xs text-right">当前数量</TableHead>
            <TableHead className="text-xs text-right">单位成本 (¥)</TableHead>
            <TableHead className="text-xs text-right">批次总价值 (¥)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.sort((a,b) => (a.expiryDate && b.expiryDate ? parseISO(a.expiryDate).getTime() - parseISO(b.expiryDate).getTime() : (a.productionDate && b.productionDate && !a.expiryDate && !b.expiryDate ? parseISO(a.productionDate).getTime() - parseISO(b.productionDate).getTime() : (a.createdAt && b.createdAt ? parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime() : 0 )))).map((batch) => {
            let expiryBadgeVariant: "default" | "secondary" | "destructive" | "outline" = "secondary";
            let daysToExpiryText = "N/A";

            if (productCategory === 'INGREDIENT' && batch.expiryDate) {
              const expiryDate = parseISO(batch.expiryDate);
              const daysToExpiry = differenceInDays(expiryDate, new Date());
              if (daysToExpiry < 0) {
                expiryBadgeVariant = "destructive";
                daysToExpiryText = `已过期 ${Math.abs(daysToExpiry)}天`;
              } else {
                daysToExpiryText = `剩 ${daysToExpiry}天`;
                if (daysToExpiry <= expiryWarningDays) expiryBadgeVariant = "outline";
              }
            }
            
            const displayDate = productCategory === 'NON_INGREDIENT' ? batch.productionDate || batch.createdAt : batch.productionDate;

            return (
              <TableRow key={batch.id}>
                {productCategory === 'INGREDIENT' && (
                  <TableCell className="text-xs">
                    {batch.productionDate ? format(parseISO(batch.productionDate), "yyyy-MM-dd") : 'N/A'}
                  </TableCell>
                )}
                {productCategory === 'INGREDIENT' && (
                  <TableCell className="text-xs">
                    {batch.expiryDate ? (
                      <Badge variant={expiryBadgeVariant} className="text-xs whitespace-nowrap">
                        {format(parseISO(batch.expiryDate), "yyyy-MM-dd")} ({daysToExpiryText})
                      </Badge>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                )}
                {productCategory === 'NON_INGREDIENT' && (
                     <TableCell className="text-xs">
                        {displayDate ? format(parseISO(displayDate), "yyyy-MM-dd") : 'N/A'}
                     </TableCell>
                )}
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

function ProductRow({ 
    product, 
    onArchive, 
    onUnarchive,
    onEdit
}: { 
    product: Product, 
    onArchive: (id: string) => void, 
    onUnarchive: (id: string) => void,
    onEdit: (product: Product) => void
}) {
  const { getProductStockDetails, appSettings } = useInventory();
  const { totalQuantity, totalValue, batches } = getProductStockDetails(product.id);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  if (!product) return null;

  const placeholderImage = `https://placehold.co/64x64.png?text=${encodeURIComponent(product.name.substring(0,1))}`;
  const imageSrc = product.imageUrl || placeholderImage;

  const handleImageClick = () => {
    if (product.imageUrl) {
      setIsImageModalOpen(true);
    }
  };

  const mainRow = (
    <TableRow key={product.id}>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="mr-2 h-8 w-8">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
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
              width={40}
              height={40}
              className="object-cover aspect-square"
              data-ai-hint="product item"
            />
          </div>
          <div>
            <div className="font-medium">{product.name}</div>
            <div className="text-xs text-muted-foreground">{formatProductCategory(product.category)}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>{product.unit}</TableCell>
      <TableCell>{product.category === 'INGREDIENT' && product.shelfLifeDays ? `${product.shelfLifeDays} 天` : 'N/A'}</TableCell>
      <TableCell className="text-right">{product.lowStockThreshold}</TableCell>
      <TableCell className="text-right">{totalQuantity}</TableCell>
      <TableCell className="text-right">¥{totalValue.toFixed(2)}</TableCell>
      <TableCell>{product.createdAt ? format(parseISO(product.createdAt), "yyyy年MM月dd日 HH:mm", {locale: zhCN}) : 'N/A'}</TableCell>
      <TableCell className="text-right space-x-1">
        {product.isArchived ? (
          <Button variant="ghost" size="sm" onClick={() => onUnarchive(product.id)} title="取消归档产品">
            <Undo className="mr-2 h-4 w-4" /> 取消归档
          </Button>
        ) : (
          <>
            <Button variant="ghost" size="icon" onClick={() => onEdit(product)} title="编辑产品">
                <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onArchive(product.id)} title="归档产品">
              <Archive className="h-4 w-4" />
            </Button>
          </>
        )}
      </TableCell>
    </TableRow>
  );
  
  const detailsRow = isExpanded ? (
    <TableRow key={`${product.id}-details`}>
      <TableCell colSpan={9}>
        <ProductBatchDetails batches={batches} unit={product.unit} productCategory={product.category} expiryWarningDays={appSettings.expiryWarningDays} />
      </TableCell>
    </TableRow>
  ) : null;

  return (
    <>
      {mainRow}
      {detailsRow}
      {isImageModalOpen && product.imageUrl && (
        <ImagePreviewModal
          imageUrl={product.imageUrl}
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          productName={product.name}
        />
      )}
    </>
  );
}

export default function ProductsPage() {
  const { products, archiveProduct, unarchiveProduct } = useInventory();
  const [activeTab, setActiveTab] = useState("active");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const activeProducts = products.filter(p => !p.isArchived);
  const archivedProducts = products.filter(p => p.isArchived);

  const productsToDisplay = activeTab === "active" ? activeProducts : archivedProducts;

  const handleOpenEditModal = (product: Product) => {
    setProductToEdit(product);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setProductToEdit(null);
    setIsEditModalOpen(false);
  };

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
                    <TableHead className="text-right">预警阈值</TableHead>
                    <TableHead className="text-right">库存数量</TableHead>
                    <TableHead className="text-right">库存总价值</TableHead>
                    <TableHead>创建日期</TableHead>
                    <TableHead className="text-right w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToDisplay.map((product) => (
                    <ProductRow key={product.id} product={product} onArchive={archiveProduct} onUnarchive={unarchiveProduct} onEdit={handleOpenEditModal} />
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
                    <TableHead className="text-right">预警阈值</TableHead>
                    <TableHead className="text-right">库存数量</TableHead>
                    <TableHead className="text-right">库存总价值</TableHead>
                    <TableHead>创建日期</TableHead>
                    <TableHead className="text-right w-[120px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToDisplay.map((product) => (
                    <ProductRow key={product.id} product={product} onArchive={archiveProduct} onUnarchive={unarchiveProduct} onEdit={handleOpenEditModal} />
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
      <EditProductForm 
        product={productToEdit}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
      />
    </div>
  );
}


"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Product, Batch, ProductCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Archive, Undo, PackageSearch, Package, ChevronDown, ChevronRight, Settings, Pencil, Search as SearchIcon, Filter, Loader2 } from "lucide-react";
import Link from "next/link";
import { format, parseISO, differenceInDays } from "date-fns";
import { zhCN } from 'date-fns/locale';
import NextImage from "next/image";
import React, { useState, Fragment, useMemo, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePreviewModal } from "@/components/modals/ImagePreviewModal";
import { EditProductForm } from "@/components/forms/EditProductForm";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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

const productCategoryOptions: { value: ProductCategory | 'ALL'; label: string }[] = [
    { value: "ALL", label: "所有类别" },
    { value: "INGREDIENT", label: "食材" },
    { value: "NON_INGREDIENT", label: "非食材" },
];

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
            let daysToExpiryText = "";

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
                       <Badge variant={expiryBadgeVariant} className="text-xs leading-tight whitespace-normal">
                        <div className="flex flex-col items-start text-left">
                          <span>{format(parseISO(batch.expiryDate), "yyyy-MM-dd")}</span>
                          {daysToExpiryText && <span className="block">{daysToExpiryText}</span>}
                        </div>
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">无限期</span>
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
    <TableRow key={`${product.id}-main`}><TableCell>
        <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="mr-2 h-8 w-8">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </TableCell><TableCell>
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
              width={48}
              height={48}
              className="object-cover aspect-square"
              data-ai-hint="product item"
            />
          </div>
          <div>
            <div className="font-medium">{product.name}</div>
          </div>
        </div>
      </TableCell><TableCell>{formatProductCategory(product.category)}</TableCell><TableCell>{product.unit}</TableCell><TableCell>{product.category === 'INGREDIENT' && product.shelfLifeDays ? `${product.shelfLifeDays} 天` : 'N/A'}</TableCell><TableCell className="text-right">{product.lowStockThreshold}</TableCell><TableCell className="text-right">{totalQuantity}</TableCell><TableCell className="text-right">¥{totalValue.toFixed(2)}</TableCell><TableCell>{product.createdAt ? format(parseISO(product.createdAt), "yyyy年MM月dd日 HH:mm", {locale: zhCN}) : 'N/A'}</TableCell><TableCell className="text-right space-x-1">
        {product.isArchived ? (
          <Button variant="ghost" size="sm" onClick={() => onUnarchive(product.id)} title="取消归档产品">
            <Undo className="mr-2 h-4 w-4" /> 取消归档
          </Button>
        ) : (
          <React.Fragment key="actions">
            <Button variant="ghost" size="icon" onClick={() => onEdit(product)} title="编辑产品">
                <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onArchive(product.id)} title="归档产品">
              <Archive className="h-4 w-4" />
            </Button>
          </React.Fragment>
        )}
      </TableCell></TableRow>
  );
  
  const detailsRow = isExpanded ? (
    <TableRow key={`${product.id}-details`}><TableCell colSpan={10}>
        <ProductBatchDetails batches={batches} unit={product.unit} productCategory={product.category} expiryWarningDays={appSettings.expiryWarningDays} />
      </TableCell></TableRow>
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
  const { products, archiveProduct, unarchiveProduct, isLoadingProducts } = useInventory(); // Added isLoadingProducts
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'ALL'>('ALL');

  useEffect(() => {
    setHasMounted(true);
  }, []);


  const filteredProducts = useMemo(() => {
    // Wait for client mount AND products to be loaded from API
    if (!hasMounted || isLoadingProducts) return []; 
    let tempProducts = products;

    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      tempProducts = tempProducts.filter(product =>
        product.name.toLowerCase().includes(lowercasedSearchTerm)
      );
    }

    if (categoryFilter !== 'ALL') {
      tempProducts = tempProducts.filter(product => product.category === categoryFilter);
    }
    
    return tempProducts;
  }, [products, searchTerm, categoryFilter, hasMounted, isLoadingProducts]);

  const productsToDisplayActive = useMemo(() => {
    if (!hasMounted || isLoadingProducts) return [];
    return filteredProducts.filter(p => !p.isArchived);
  }, [filteredProducts, hasMounted, isLoadingProducts]);

  const productsToDisplayArchived = useMemo(() => {
    if (!hasMounted || isLoadingProducts) return [];
    return filteredProducts.filter(p => p.isArchived);
  }, [filteredProducts, hasMounted, isLoadingProducts]);

  const productsToDisplay = activeTab === "active" ? productsToDisplayActive : productsToDisplayArchived;

  const handleOpenEditModal = (product: Product) => {
    setProductToEdit(product);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setProductToEdit(null);
    setIsEditModalOpen(false);
  };
  
  const getNoProductMessage = () => {
    if (searchTerm && categoryFilter !== 'ALL') {
      return `没有${activeTab === 'active' ? '活动' : '已归档'}产品匹配搜索词 “${searchTerm}” 和类别 “${formatProductCategory(categoryFilter as ProductCategory)}”。`;
    }
    if (searchTerm) {
      return `没有${activeTab === 'active' ? '活动' : '已归档'}产品匹配搜索词 “${searchTerm}”。`;
    }
    if (categoryFilter !== 'ALL') {
      return `没有${activeTab === 'active' ? '活动' : '已归档'}产品属于类别 “${formatProductCategory(categoryFilter as ProductCategory)}”。`;
    }
    return activeTab === 'active' ? '无活动产品' : '无已归档产品';
  };

  const getNoProductDescription = () => {
    if (searchTerm || categoryFilter !== 'ALL') return "请尝试调整您的搜索或筛选条件。";
    return activeTab === 'active' ? '添加一些产品开始吧！' : '您归档的产品将显示在此处。';
  };

  if (!hasMounted || isLoadingProducts) { // Show skeleton if not mounted OR products are loading
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-8 w-8" /> 产品管理</h1>
          <Skeleton className="h-10 w-[140px]" /> {/* Button placeholder */}
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-grow" /> {/* Search input placeholder */}
          <Skeleton className="h-10 w-full sm:w-[180px]" /> {/* Select placeholder */}
        </div>
        <Tabs value="active">
          <TabsList>
            <Skeleton className="h-9 w-24 mr-2 px-3 py-1.5" /> {/* Tab placeholder */}
            <Skeleton className="h-9 w-28 px-3 py-1.5" /> {/* Tab placeholder */}
          </TabsList>
          <TabsContent value="active">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>类别</TableHead>
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
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={`skeleton-row-${i}`}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                      <TableCell><div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-md" /> <div><Skeleton className="h-5 w-24 mb-1" /><Skeleton className="h-4 w-16" /></div></div></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-10 inline-block" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-10 inline-block" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-5 w-20 inline-block" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Skeleton className="h-8 w-8 inline-block rounded-md" />
                        <Skeleton className="h-8 w-8 inline-block rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
        {/* Edit modal doesn't need to be in skeleton, it appears on interaction */}
      </div>
    );
  }

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

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
            type="search"
            placeholder="搜索产品名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10" 
            />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[180px]">
            <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as ProductCategory | 'ALL')}
            >
                <SelectTrigger className="w-full">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="按类别筛选" />
                </SelectTrigger>
                <SelectContent>
                    {productCategoryOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">活动 ({productsToDisplayActive.length})</TabsTrigger>
          <TabsTrigger value="archived">已归档 ({productsToDisplayArchived.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {productsToDisplay.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead> {/* For expand icon */}
                    <TableHead>名称</TableHead>
                    <TableHead>类别</TableHead>
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
                {isLoadingProducts ? (
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                ) : (
                  <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
                )}
                <h3 className="text-xl font-semibold">{isLoadingProducts ? "正在加载产品..." : getNoProductMessage()}</h3>
                {!isLoadingProducts && <p className="text-muted-foreground mb-4">{getNoProductDescription()}</p>}
                {!isLoadingProducts && !(searchTerm || categoryFilter !== 'ALL') && activeTab === 'active' && (
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
                    <TableHead className="w-[50px]"></TableHead> {/* For expand icon */}
                    <TableHead>名称</TableHead>
                    <TableHead>类别</TableHead>
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
                {isLoadingProducts ? (
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                ) : (
                  <PackageSearch className="h-16 w-16 text-muted-foreground mb-4" />
                )}
                <h3 className="text-xl font-semibold">{isLoadingProducts ? "正在加载产品..." : getNoProductMessage()}</h3>
                {!isLoadingProducts && <p className="text-muted-foreground mb-4">{getNoProductDescription()}</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      {productToEdit && ( 
        <EditProductForm 
            product={productToEdit}
            isOpen={isEditModalOpen}
            onClose={handleCloseEditModal}
        />
      )}
    </div>
  );
}

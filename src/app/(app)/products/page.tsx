
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Product, Batch, ProductCategory, ProductTableColumn, ProductColumnKey } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
    PlusCircle, Archive, Undo, PackageSearch, Package, ChevronDown, ChevronRight,
    Pencil, Search as SearchIcon, Filter, Loader2, ArrowUpDown, Eye, ArrowUp, ArrowDown,
    Download, FileText
} from "lucide-react";
import Link from "next/link";
import { format, parseISO, differenceInDays } from "date-fns";
import { zhCN } from 'date-fns/locale';
import NextImage from "next/image";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePreviewModal } from "@/components/modals/ImagePreviewModal";
import { EditProductForm } from "@/components/forms/EditProductForm";
import { DailyStockReportModal } from "@/components/modals/DailyStockReportModal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

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
    { value: "INGREDIENT", label: formatProductCategory("INGREDIENT") },
    { value: "NON_INGREDIENT", label: formatProductCategory("NON_INGREDIENT") },
];

const ALL_PRODUCT_COLUMNS: ProductTableColumn[] = [
  { id: 'name', label: '名称', defaultVisible: true, sortable: false, getValue: (p) => p.name, isNumeric: false, isDate: false, headerClassName: "min-w-[200px]" },
  { id: 'category', label: '类别', defaultVisible: true, sortable: false, getValue: (p) => formatProductCategory(p.category), isNumeric: false, isDate: false },
  { id: 'unit', label: '单位', defaultVisible: true, sortable: false, getValue: (p) => p.unit, isNumeric: false, isDate: false },
  { id: 'shelfLifeDays', label: '保质期', defaultVisible: false, sortable: false, getValue: (p) => p.category === 'INGREDIENT' && p.shelfLifeDays ? p.shelfLifeDays : null, isNumeric: true, isDate: false, cellClassName: "text-center", headerClassName: "text-center" },
  { id: 'totalQuantity', label: '库存数量', defaultVisible: true, sortable: true, getValue: (p, details) => details.totalQuantity, isNumeric: true, isDate: false, cellClassName: "text-right", headerClassName: "text-right" },
  { id: 'totalValue', label: '库存总价值', defaultVisible: true, sortable: true, getValue: (p, details) => details.totalValue, isNumeric: true, isDate: false, cellClassName: "text-right", headerClassName: "text-right" },
  { id: 'createdAt', label: '创建日期', defaultVisible: false, sortable: false, getValue: (p) => p.createdAt, isNumeric: false, isDate: true, cellClassName: "min-w-[150px]" },
];

const LOCAL_STORAGE_VISIBLE_COLUMNS_KEY = 'inventory_product_table_visible_columns_v4';


function ProductBatchDetails({ batches, unit, productCategory, expiryWarningDays }: { batches: Batch[], unit: string, productCategory: ProductCategory, expiryWarningDays: number }) {
  if (batches.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">该产品暂无活动批次信息。</p>;
  }

  return (
    <div className="p-4 bg-muted/50 rounded-md">
      <h4 className="text-md font-semibold mb-2">批次详情</h4>
      <Table>
        <TableHeader>
          <TableRow className="break-inside-avoid-page">
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
                daysToExpiryText = `已过期 ${Math.abs(daysToExpiry)} 天`;
              } else {
                daysToExpiryText = `剩 ${daysToExpiry} 天`;
                if (daysToExpiry <= expiryWarningDays) expiryBadgeVariant = "outline";
              }
            }

            const displayDate = productCategory === 'NON_INGREDIENT' ? batch.productionDate || batch.createdAt : batch.productionDate;

            return (
              <TableRow key={batch.id} className="break-inside-avoid-page">
                {productCategory === 'INGREDIENT' && (
                  <TableCell className="text-xs">
                    {batch.productionDate ? format(parseISO(batch.productionDate), "yyyy-MM-dd") : 'N/A'}
                  </TableCell>
                )}
                {productCategory === 'INGREDIENT' && (
                  <TableCell className="text-xs">
                    {batch.expiryDate ? (
                       <Badge variant={expiryBadgeVariant} className="text-xs leading-tight">
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
                <TableCell className="text-xs text-right">¥{batch.unitCost.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-right">¥{(batch.currentQuantity * batch.unitCost).toFixed(2)}</TableCell>
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
    onEdit,
    visibleColumns,
    productDetails
}: {
    product: Product,
    onArchive: (id: string) => void,
    onUnarchive: (id: string) => void,
    onEdit: (product: Product) => void,
    visibleColumns: Record<ProductColumnKey, boolean>,
    productDetails: { totalQuantity: number; totalValue: number; batches: Batch[] }
}) {
  const { appSettings } = useInventory();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  if (!product) return null;

  const placeholderImage = `https://placehold.co/48x48.png?text=${encodeURIComponent(product.name.substring(0,1))}`;
  const imageSrc = product.imageUrl || placeholderImage;

  const handleImageClick = () => {
    if (product.imageUrl) {
      setIsImageModalOpen(true);
    }
  };

  const { totalQuantity, totalValue, batches } = productDetails;

  const mainRowCells = ALL_PRODUCT_COLUMNS.filter(col => visibleColumns[col.id]).map(colDef => {
    let cellContent: React.ReactNode;
    if (colDef.id === 'name') {
      cellContent = (
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
      );
    } else if (colDef.id === 'shelfLifeDays') {
        cellContent = product.category === 'INGREDIENT' && product.shelfLifeDays ? `${product.shelfLifeDays} 天` : 'N/A';
    } else if (colDef.id === 'totalValue') {
        cellContent = `¥${totalValue.toFixed(2)}`;
    } else if (colDef.id === 'createdAt') {
        cellContent = product.createdAt ? format(parseISO(product.createdAt), "yyyy年MM月dd日 HH:mm", {locale: zhCN}) : 'N/A';
    } else {
      cellContent = colDef.getValue(product, productDetails);
    }
    return <TableCell key={`${product.id}-${colDef.id}`} className={colDef.cellClassName}>{cellContent}</TableCell>;
  });

  const numberOfVisibleDataColumns = ALL_PRODUCT_COLUMNS.filter(col => visibleColumns[col.id]).length;
  const numberOfTotalColumns = 1 + numberOfVisibleDataColumns + 1;

  return (
    <>
      <TableRow key={`${product.id}-mainRow`} >
        <TableCell className="w-[50px]">
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="mr-2 h-8 w-8">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
        </TableCell>
        {mainRowCells}
        <TableCell className="text-right space-x-1 w-[120px]">
            {product.isArchived ? (
            <Button variant="outline" size="sm" onClick={() => onUnarchive(product.id)} title="取消归档产品">
                <Undo className="mr-2 h-4 w-4" /> 取消归档
            </Button>
            ) : (
            <React.Fragment key={`${product.id}-actions`}>
                <Button variant="ghost" size="icon" onClick={() => onEdit(product)} title="编辑产品">
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onArchive(product.id)} title="归档产品">
                <Archive className="h-4 w-4" />
                </Button>
            </React.Fragment>
            )}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow key={`${product.id}-detailsRow`}>
          <TableCell colSpan={numberOfTotalColumns}>
            <ProductBatchDetails batches={batches} unit={product.unit} productCategory={product.category} expiryWarningDays={appSettings.expiryWarningDays} />
          </TableCell>
        </TableRow>
      )}
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

type SortConfig = {
  key: ProductColumnKey | null;
  direction: 'ascending' | 'descending' | null;
};


export default function ProductsPage() {
  const { products, archiveProduct, unarchiveProduct, isLoadingProducts, getProductStockDetails, transactions } = useInventory();
  const [hasMounted, setHasMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'ALL'>('ALL');
  const [isDailyReportModalOpen, setIsDailyReportModalOpen] = useState(false);

  const initialVisibleColumns = useMemo(() => {
    const defaults = {} as Record<ProductColumnKey, boolean>;
    ALL_PRODUCT_COLUMNS.forEach(col => {
        defaults[col.id] = col.defaultVisible;
    });
    defaults['name'] = true;
    return defaults;
  }, []);

  const [visibleColumns, setVisibleColumns] = useState<Record<ProductColumnKey, boolean>>(initialVisibleColumns);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'descending' });

  useEffect(() => {
    setHasMounted(true);
    const storedVisibleColumns = localStorage.getItem(LOCAL_STORAGE_VISIBLE_COLUMNS_KEY);
    if (storedVisibleColumns) {
      try {
        const parsedColumns = JSON.parse(storedVisibleColumns) as Record<ProductColumnKey, boolean>;
        const validatedColumns = { ...initialVisibleColumns };
        for (const colDef of ALL_PRODUCT_COLUMNS) {
            if (parsedColumns.hasOwnProperty(colDef.id) && colDef.id !== 'name') {
                validatedColumns[colDef.id] = parsedColumns[colDef.id];
            }
        }
        setVisibleColumns(validatedColumns);
      } catch (e) {
        console.error("Failed to parse visible columns from localStorage", e);
        setVisibleColumns(initialVisibleColumns);
      }
    } else {
        setVisibleColumns(initialVisibleColumns);
    }
  }, [initialVisibleColumns]);

  useEffect(() => {
    if (hasMounted) {
      localStorage.setItem(LOCAL_STORAGE_VISIBLE_COLUMNS_KEY, JSON.stringify(visibleColumns));
    }
  }, [visibleColumns, hasMounted]);

  useEffect(() => {
    if (!productToEdit) {
      setIsEditModalOpen(false);
    }
  }, [productToEdit]);


  const handleSort = (columnKey: ProductColumnKey) => {
    setSortConfig(prevSortConfig => {
      if (prevSortConfig.key === columnKey) {
        if (prevSortConfig.direction === 'descending') {
          return { key: columnKey, direction: 'ascending' };
        } else if (prevSortConfig.direction === 'ascending') {
          return { key: null, direction: null };
        } else {
          return { key: columnKey, direction: 'descending' };
        }
      } else {
        return { key: columnKey, direction: 'descending' };
      }
    });
  };

  const filteredAndSortedProducts = useMemo(() => {
    if (!hasMounted || isLoadingProducts) return [];
    let tempProducts = [...products];

    if (searchTerm) {
      const lowercasedSearchTerm = searchTerm.toLowerCase();
      tempProducts = tempProducts.filter(product =>
        product.name.toLowerCase().includes(lowercasedSearchTerm)
      );
    }

    if (categoryFilter !== 'ALL') {
      tempProducts = tempProducts.filter(product => product.category === categoryFilter);
    }

    if (sortConfig.key && sortConfig.direction) {
      const columnDefinition = ALL_PRODUCT_COLUMNS.find(c => c.id === sortConfig.key);
      if (columnDefinition && columnDefinition.sortable) {
        tempProducts = [...tempProducts].sort((a, b) => {
          const detailsA = getProductStockDetails(a.id);
          const detailsB = getProductStockDetails(b.id);

          let valA = columnDefinition.getValue(a, detailsA);
          let valB = columnDefinition.getValue(b, detailsB);

          if (columnDefinition.isNumeric) {
            valA = Number(valA) || 0;
            valB = Number(valB) || 0;
            return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
          } else if (columnDefinition.isDate && valA && valB) {
            valA = parseISO(valA as string).getTime();
            valB = parseISO(valB as string).getTime();
            return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
          } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            return sortConfig.direction === 'ascending' ? valA.localeCompare(valB, 'zh-CN') : valB.localeCompare(valA, 'zh-CN');
          }
        });
      }
    }
    return tempProducts;
  }, [products, searchTerm, categoryFilter, sortConfig, hasMounted, isLoadingProducts, getProductStockDetails]);

  const productsToDisplayActive = useMemo(() => {
    if (!hasMounted || isLoadingProducts) return [];
    return filteredAndSortedProducts.filter(p => !p.isArchived);
  }, [filteredAndSortedProducts, hasMounted, isLoadingProducts]);

  const productsToDisplayArchived = useMemo(() => {
    if (!hasMounted || isLoadingProducts) return [];
    return filteredAndSortedProducts.filter(p => p.isArchived);
  }, [filteredAndSortedProducts, hasMounted, isLoadingProducts]);

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
    if (searchTerm || categoryFilter !== 'ALL') {
        const searchMsg = searchTerm ? `搜索词 “${searchTerm}”` : "";
        const categoryMsg = categoryFilter !== 'ALL' ? `类别 “${formatProductCategory(categoryFilter as ProductCategory)}”` : "";
        const connector = searchTerm && categoryFilter !== 'ALL' ? "和" : "";
        return `没有${activeTab === 'active' ? '活动' : '已归档'}产品匹配 ${searchMsg} ${connector} ${categoryMsg}。`;
    }
    return activeTab === 'active' ? '无活动产品' : '无已归档产品';
  };

  const getNoProductDescription = () => {
    if (searchTerm || categoryFilter !== 'ALL') return "请尝试调整您的搜索或筛选条件。";
    return activeTab === 'active' ? '添加一些产品开始吧！' : '您归档的产品将显示在此处。';
  };

  const displayedColumns = ALL_PRODUCT_COLUMNS.filter(col => visibleColumns[col.id] || col.id === 'name');

  const handleExportToCSV = useCallback(() => {
    const activeProductsWithDetails = products
      .filter(p => !p.isArchived)
      .map(p => ({ product: p, details: getProductStockDetails(p.id) }));

    if (activeProductsWithDetails.length === 0) {
      alert("没有活动产品可供导出。");
      return;
    }

    const csvRows: string[][] = [];
    const headers = [
      "产品ID", "产品名称", "类别", "单位", "保质期(天)", "创建日期", "是否已归档",
      "产品总库存", "产品总价值(¥)",
      "批次ID", "批次生产日期", "批次过期日期", "批次初始数量", "批次当前数量", "批次单位成本(¥)"
    ];
    csvRows.push(headers);

    const formatDateForCSV = (dateString: string | null) => {
        return dateString ? format(parseISO(dateString), "yyyy-MM-dd HH:mm:ss") : "";
    };

    const formatCategoryForCSV = (category: ProductCategory) => {
        return category === "INGREDIENT" ? "食材" : "非食材";
    };

    activeProductsWithDetails.forEach(({ product, details }) => {
      const commonProductData = [
        product.id,
        product.name,
        formatCategoryForCSV(product.category),
        product.unit,
        product.category === 'INGREDIENT' && product.shelfLifeDays ? String(product.shelfLifeDays) : "",
        formatDateForCSV(product.createdAt),
        product.isArchived ? "是" : "否",
        String(details.totalQuantity),
        details.totalValue.toFixed(2),
      ];

      if (details.batches.length > 0) {
        details.batches.forEach(batch => {
          csvRows.push([
            ...commonProductData,
            batch.id,
            formatDateForCSV(batch.productionDate),
            formatDateForCSV(batch.expiryDate),
            String(batch.initialQuantity),
            String(batch.currentQuantity),
            batch.unitCost.toFixed(2)
          ]);
        });
      } else {
        csvRows.push([
          ...commonProductData,
          "", "", "", "", "", ""
        ]);
      }
    });

    const csvString = csvRows.map(row =>
        row.map(field => {
            const strField = String(field === null || field === undefined ? "" : field);
            if (strField.includes(',') || strField.includes('\n') || strField.includes('"')) {
                return `"${strField.replace(/"/g, '""')}"`;
            }
            return strField;
        }).join(',')
    ).join('\n');

    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `傲慢与偏见咖啡庄园_产品明细_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [products, getProductStockDetails]);


  if (!hasMounted || isLoadingProducts) {
    const skeletonColumnCount = ALL_PRODUCT_COLUMNS.filter(col => initialVisibleColumns[col.id] || col.id === 'name').length;
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-8 w-8" /> 产品管理</h1>
          <div className="flex gap-2">
             <Skeleton className="h-10 w-[120px]" />
             <Skeleton className="h-10 w-[140px]" />
             <Skeleton className="h-10 w-[160px]" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-grow" />
          <Skeleton className="h-10 w-full sm:w-[180px]" />
          <Skeleton className="h-10 w-10 sm:w-auto" />
        </div>
        <Tabs value="active">
          <TabsList>
            <Skeleton className="h-9 w-24 mr-2 px-3 py-1.5" />
            <Skeleton className="h-9 w-28 px-3 py-1.5" />
          </TabsList>
          <TabsContent value="active">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    {Array.from({ length: skeletonColumnCount }).map((_, idx) => (
                        <TableHead key={`skel-head-col-${idx}-mainSkel`} >
                            <Skeleton className="h-5 w-20"/>
                        </TableHead>
                    ))}
                    <TableHead className="text-right w-[120px]"><Skeleton className="h-5 w-16 inline-block"/></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={`skeleton-row-${i}-mainSkel`}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                      {Array.from({ length: skeletonColumnCount }).map((_, colIdx) => (
                        <TableCell key={`skel-cell-${i}-${colIdx}-mainSkel`} >
                            {colIdx === 0 ?
                                (<div className="flex items-center gap-3"><Skeleton className="h-12 w-12 rounded-md" /> <div><Skeleton className="h-5 w-24 mb-1" /><Skeleton className="h-4 w-16" /></div></div>) :
                                (<Skeleton className="h-5 w-16" />)
                            }
                        </TableCell>
                      ))}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-8 w-8" /> 产品管理</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setIsDailyReportModalOpen(true)} variant="outline">
            <FileText className="mr-2 h-4 w-4" /> 生成当日报告
          </Button>
          <Button onClick={handleExportToCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" /> 导出为CSV
          </Button>
          <Button asChild>
            <Link href="/products/add">
              <PlusCircle className="mr-2 h-4 w-4" /> 添加新产品
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        <div className="relative flex-grow">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
            type="search"
            placeholder="搜索产品名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 h-10"
            />
        </div>
        <div className="w-full sm:w-auto sm:min-w-[180px]">
            <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as ProductCategory | 'ALL')}
            >
                <SelectTrigger className="w-full h-10">
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
        <div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full sm:w-auto">
                        <Eye className="mr-2 h-4 w-4" /> 显示列
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>切换列显示</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ALL_PRODUCT_COLUMNS.filter(col => col.id !== 'name').map((column) => (
                        <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={visibleColumns[column.id]}
                        onCheckedChange={(value) =>
                            setVisibleColumns(prev => ({...prev, [column.id]: !!value}))
                        }
                        >
                        {column.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
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
                    {displayedColumns.map(colDef => (
                         <TableHead
                            key={colDef.id}
                            className={cn(colDef.headerClassName, colDef.sortable && 'cursor-pointer')}
                            onClick={colDef.sortable ? () => handleSort(colDef.id) : undefined}
                        >
                            {colDef.label}
                            {colDef.sortable && (
                                sortConfig.key === colDef.id && sortConfig.direction ? (
                                    sortConfig.direction === 'ascending' ?
                                    <ArrowUp className="ml-2 h-3 w-3 inline-block" /> :
                                    <ArrowDown className="ml-2 h-3 w-3 inline-block" />
                                ) : (
                                    <ArrowUpDown className="ml-2 h-3 w-3 inline-block opacity-50" />
                                )
                            )}
                        </TableHead>
                    ))}
                    <TableHead className="text-right w-[120px]">操作</TableHead> {/* Actions column */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToDisplay.map((product) => (
                    <ProductRow
                        key={product.id}
                        product={product}
                        onArchive={archiveProduct}
                        onUnarchive={unarchiveProduct}
                        onEdit={handleOpenEditModal}
                        visibleColumns={visibleColumns}
                        productDetails={getProductStockDetails(product.id)}
                    />
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
                     {displayedColumns.map(colDef => (
                         <TableHead
                            key={colDef.id}
                            className={cn(colDef.headerClassName, colDef.sortable && 'cursor-pointer')}
                            onClick={colDef.sortable ? () => handleSort(colDef.id) : undefined}
                        >
                            {colDef.label}
                            {colDef.sortable && (
                                sortConfig.key === colDef.id && sortConfig.direction ? (
                                    sortConfig.direction === 'ascending' ?
                                    <ArrowUp className="ml-2 h-3 w-3 inline-block" /> :
                                    <ArrowDown className="ml-2 h-3 w-3 inline-block" />
                                ) : (
                                    <ArrowUpDown className="ml-2 h-3 w-3 inline-block opacity-50" />
                                )
                            )}
                        </TableHead>
                    ))}
                    <TableHead className="text-right w-[120px]">操作</TableHead> {/* Actions column */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToDisplay.map((product) => (
                    <ProductRow
                        key={product.id}
                        product={product}
                        onArchive={archiveProduct}
                        onUnarchive={unarchiveProduct}
                        onEdit={handleOpenEditModal}
                        visibleColumns={visibleColumns}
                        productDetails={getProductStockDetails(product.id)}
                    />
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
      {isDailyReportModalOpen && (
        <DailyStockReportModal
          isOpen={isDailyReportModalOpen}
          onClose={() => setIsDailyReportModalOpen(false)}
          products={products.filter(p => !p.isArchived)}
          transactions={transactions}
          currentDate={new Date()}
          getProductStockDetails={getProductStockDetails}
        />
      )}
    </div>
  );
}

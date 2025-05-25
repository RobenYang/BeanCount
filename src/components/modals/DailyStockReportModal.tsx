
"use client";

import type { Product, Transaction } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, isSameDay, parseISO } from "date-fns";
import { zhCN } from 'date-fns/locale';
import React from "react";

interface DailyStockReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  transactions: Transaction[];
  currentDate: Date;
  getProductStockDetails: (productId: string) => { totalQuantity: number; totalValue: number; batches: any[] };
}

export function DailyStockReportModal({ 
  isOpen, 
  onClose, 
  products: allProducts, 
  transactions, 
  currentDate, 
  getProductStockDetails 
}: DailyStockReportModalProps) {

  const activeProducts = allProducts.filter(p => !p.isArchived);

  const todaysTransactions = transactions.filter(t => 
    isSameDay(parseISO(t.timestamp), currentDate)
  );

  const todaysIntake = todaysTransactions.filter(t => t.type === 'IN' || (t.type === 'OUT' && t.isCorrectionIncrease));
  const todaysOutflow = todaysTransactions.filter(t => t.type === 'OUT' && !t.isCorrectionIncrease);

  const handlePrint = () => {
    const elementsToHide = document.querySelectorAll('.no-print');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');
    
    window.print();

    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
  };

  const commonTableCellClass = "py-1.5 px-2 text-xs @print:py-0.5 @print:px-1";
  const commonTableHeadClass = "py-2 px-2 text-xs @print:py-1 @print:px-1";
  const sectionMarginBottom = "mb-4 @print:mb-2";
  const sectionHeaderClass = "text-base font-semibold mb-1 border-b pb-0.5 @print:text-sm @print:mb-0.5";


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col @print:shadow-none @print:border-none @print:max-h-none @print:max-w-none @print:m-0 @print:p-0">
        <DialogHeader className="no-print">
          <DialogTitle>当日库存报告 - {format(currentDate, "yyyy年M月d日", { locale: zhCN })}</DialogTitle>
          <DialogDescription>
            此报告总结了截至今日的产品库存水平以及今日的库存变动情况。
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 @print:overflow-visible @print:h-auto">
          <div className="p-1 @print:p-0" id="daily-report-content">
            <div className="text-center mb-2 @print:mb-1">
                <h2 className="text-lg font-bold @print:text-base">傲慢与偏见咖啡庄园 - 每日库存报告</h2>
                <p className="text-sm @print:text-xs">{format(currentDate, "yyyy年M月d日 EEEE", { locale: zhCN })}</p>
            </div>

            <section className={sectionMarginBottom}>
              <h3 className={sectionHeaderClass}>当前库存水平</h3>
              {activeProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={commonTableHeadClass}>产品名称</TableHead>
                      <TableHead className={`${commonTableHeadClass} text-right`}>当前数量</TableHead>
                      <TableHead className={commonTableHeadClass}>单位</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeProducts.map(product => {
                      const { totalQuantity } = getProductStockDetails(product.id);
                      return (
                        <TableRow key={product.id}>
                          <TableCell className={commonTableCellClass}>{product.name}</TableCell>
                          <TableCell className={`${commonTableCellClass} text-right`}>{totalQuantity}</TableCell>
                          <TableCell className={commonTableCellClass}>{product.unit}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground @print:text-xs">暂无活动产品。</p>
              )}
            </section>

            <section className={sectionMarginBottom}>
              <h3 className={sectionHeaderClass}>今日入库明细 ({todaysIntake.length})</h3>
              {todaysIntake.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`${commonTableHeadClass} w-[50px]`}>时间</TableHead>
                      <TableHead className={commonTableHeadClass}>产品名称</TableHead>
                      <TableHead className={`${commonTableHeadClass} w-[80px]`}>批次ID</TableHead>
                      <TableHead className={`${commonTableHeadClass} text-right w-[60px]`}>数量</TableHead>
                      <TableHead className={`${commonTableHeadClass} text-right w-[70px]`}>单位成本</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysIntake.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className={commonTableCellClass}>{format(parseISO(t.timestamp), "HH:mm", { locale: zhCN })}</TableCell>
                        <TableCell className={commonTableCellClass}>{t.productName}</TableCell>
                        <TableCell className={`${commonTableCellClass} truncate max-w-[80px]`} title={t.batchId || undefined}>{t.batchId || 'N/A'}</TableCell>
                        <TableCell className={`${commonTableCellClass} text-right`}>{t.isCorrectionIncrease ? `+${t.quantity}` : (t.type === 'IN' ? `+${t.quantity}`: `${t.quantity}`)}</TableCell>
                        <TableCell className={`${commonTableCellClass} text-right`}>¥{t.unitCostAtTransaction?.toFixed(2) || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground @print:text-xs">今日无入库记录。</p>
              )}
            </section>

            <section>
              <h3 className={sectionHeaderClass}>今日出库/消耗明细 ({todaysOutflow.length})</h3>
              {todaysOutflow.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`${commonTableHeadClass} w-[50px]`}>时间</TableHead>
                      <TableHead className={commonTableHeadClass}>产品名称</TableHead>
                      <TableHead className={`${commonTableHeadClass} w-[80px]`}>批次ID</TableHead>
                      <TableHead className={`${commonTableHeadClass} text-right w-[60px]`}>数量</TableHead>
                      <TableHead className={`${commonTableHeadClass} w-[70px]`}>原因</TableHead>
                      <TableHead className={`${commonTableHeadClass} text-right w-[70px]`}>价值</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysOutflow.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className={commonTableCellClass}>{format(parseISO(t.timestamp), "HH:mm", { locale: zhCN })}</TableCell>
                        <TableCell className={commonTableCellClass}>{t.productName}</TableCell>
                        <TableCell className={`${commonTableCellClass} truncate max-w-[80px]`} title={t.batchId || undefined}>{t.batchId || 'N/A'}</TableCell>
                        <TableCell className={`${commonTableCellClass} text-right`}>-{t.quantity}</TableCell>
                        <TableCell className={commonTableCellClass}>{t.reason || 'N/A'}</TableCell>
                        <TableCell className={`${commonTableCellClass} text-right`}>
                          ¥{t.unitCostAtTransaction !== undefined && t.unitCostAtTransaction !== null 
                            ? (t.quantity * t.unitCostAtTransaction).toFixed(2) 
                            : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-xs text-muted-foreground @print:text-xs">今日无出库/消耗记录。</p>
              )}
            </section>
            <p className="text-xs text-muted-foreground mt-4 text-center @print:mt-2 @print:text-[8px]">报告生成于: {format(new Date(), "yyyy-MM-dd HH:mm:ss")}</p>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 no-print">
          <Button type="button" variant="outline" onClick={handlePrint}>打印报告</Button>
          <DialogClose asChild>
            <Button type="button">关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


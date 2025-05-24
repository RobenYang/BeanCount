
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
  getProductStockDetails: (productId: string) => { totalQuantity: number; totalValue: number; batches: any[] }; // Use 'any[]' for batches if not strictly typed here
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

  const todaysIntake = todaysTransactions.filter(t => t.type === 'IN');
  const todaysOutflow = todaysTransactions.filter(t => t.type === 'OUT');

  const handlePrint = () => {
    // Temporarily hide non-printable elements
    const elementsToHide = document.querySelectorAll('.no-print');
    elementsToHide.forEach(el => (el as HTMLElement).style.display = 'none');
    
    window.print();

    // Restore hidden elements
    elementsToHide.forEach(el => (el as HTMLElement).style.display = '');
  };

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
            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2 border-b pb-1">当前库存水平</h3>
              {activeProducts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品名称</TableHead>
                      <TableHead className="text-right">当前数量</TableHead>
                      <TableHead>单位</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeProducts.map(product => {
                      const { totalQuantity } = getProductStockDetails(product.id);
                      return (
                        <TableRow key={product.id}>
                          <TableCell>{product.name}</TableCell>
                          <TableCell className="text-right">{totalQuantity}</TableCell>
                          <TableCell>{product.unit}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">暂无活动产品。</p>
              )}
            </section>

            <section className="mb-6">
              <h3 className="text-lg font-semibold mb-2 border-b pb-1">今日入库明细 ({todaysIntake.length})</h3>
              {todaysIntake.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>批次ID</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead className="text-right">单位成本(¥)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysIntake.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{format(parseISO(t.timestamp), "HH:mm:ss", { locale: zhCN })}</TableCell>
                        <TableCell>{t.productName}</TableCell>
                        <TableCell className="text-xs truncate max-w-[80px]" title={t.batchId}>{t.batchId || 'N/A'}</TableCell>
                        <TableCell className="text-right">+{t.quantity}</TableCell>
                        <TableCell className="text-right">{t.unitCostAtTransaction?.toFixed(2) || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">今日无入库记录。</p>
              )}
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 border-b pb-1">今日出库/消耗明细 ({todaysOutflow.length})</h3>
              {todaysOutflow.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>时间</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>批次ID</TableHead>
                      <TableHead className="text-right">数量</TableHead>
                      <TableHead>原因</TableHead>
                      <TableHead className="text-right">价值(¥)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaysOutflow.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{format(parseISO(t.timestamp), "HH:mm:ss", { locale: zhCN })}</TableCell>
                        <TableCell>{t.productName}</TableCell>
                        <TableCell className="text-xs truncate max-w-[80px]" title={t.batchId}>{t.batchId || 'N/A'}</TableCell>
                        <TableCell className="text-right">{t.isCorrectionIncrease ? `+${t.quantity}` : `-${t.quantity}`}</TableCell>
                        <TableCell>{t.reason || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          {t.unitCostAtTransaction !== undefined && t.unitCostAtTransaction !== null 
                            ? (t.quantity * t.unitCostAtTransaction).toFixed(2) 
                            : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">今日无出库/消耗记录。</p>
              )}
            </section>
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

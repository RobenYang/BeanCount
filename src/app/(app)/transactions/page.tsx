
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Transaction } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { format, parseISO } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";

function formatTransactionType(type: Transaction['type'], isCorrectionIncrease?: boolean) {
  if (type === 'IN') {
    return <Badge variant="secondary" className="text-green-600 border-green-600/50"><ArrowDownToLine className="h-3 w-3 mr-1" />入库</Badge>;
  }
  if (isCorrectionIncrease) {
    return <Badge variant="outline" className="text-blue-600 border-blue-600/50"><ArrowDownToLine className="h-3 w-3 mr-1" />修正入库</Badge>;
  }
  return <Badge variant="outline" className="text-red-600 border-red-600/50"><ArrowUpFromLine className="h-3 w-3 mr-1" />出库</Badge>;
}

function formatOutflowReason(reason?: Transaction['reason']) {
  if (!reason) return 'N/A';
  switch (reason) {
    case 'SALE': return '销售';
    case 'SPOILAGE': return '损耗';
    case 'INTERNAL_USE': return '内部使用';
    case 'ADJUSTMENT_DECREASE': return '误操作修正';
    default: return reason;
  }
}

export default function TransactionsPage() {
  const { transactions } = useInventory();

  const sortedTransactions = [...transactions].sort((a, b) =>
    parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          交易记录
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>所有交易明细</CardTitle>
          <CardDescription>按时间从新到旧排序。包括所有产品的入库和出库记录。</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedTransactions.length > 0 ? (
            <ScrollArea className="h-[65vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>产品名称</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">单位成本</TableHead>
                    <TableHead className="text-right">总价值</TableHead>
                    <TableHead>原因</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>批次ID</TableHead>
                    <TableHead>时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatTransactionType(transaction.type, transaction.isCorrectionIncrease)}</TableCell>
                      <TableCell>{transaction.productName}</TableCell>
                      <TableCell className="text-right">
                        {transaction.isCorrectionIncrease ? `+${transaction.quantity}` : (transaction.type === 'IN' ? `+${transaction.quantity}` : `-${transaction.quantity}`)}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.unitCostAtTransaction !== undefined ? `¥${transaction.unitCostAtTransaction.toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.unitCostAtTransaction !== undefined ? `¥${(transaction.quantity * transaction.unitCostAtTransaction).toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell>{transaction.type === 'OUT' ? formatOutflowReason(transaction.reason) : 'N/A'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={transaction.notes}>{transaction.notes || 'N/A'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[100px]" title={transaction.batchId}>{transaction.batchId || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(transaction.timestamp), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              <History className="mx-auto h-12 w-12 mb-4" />
              <p>暂无交易记录。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

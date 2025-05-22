
"use client";

import { useInventory } from "@/contexts/InventoryContext";
import type { Transaction, TransactionTimeFilterValue, TransactionTimeFilterOption } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History, ArrowDownToLine, ArrowUpFromLine, Loader2, CalendarIcon, Filter, X } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, subDays, startOfMonth, endOfMonth, subMonths, isSameDay } from "date-fns";
import { zhCN } from 'date-fns/locale';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TIME_FILTER_OPTIONS: TransactionTimeFilterOption[] = [
  { value: 'ALL', label: '所有记录' },
  { value: 'TODAY', label: '今天' },
  { value: 'YESTERDAY', label: '昨天' },
  { value: 'LAST_7_DAYS', label: '过去7天 (不含今天)' },
  { value: 'LAST_30_DAYS', label: '过去30天 (不含今天)' },
  { value: 'THIS_MONTH', label: '本月' },
  { value: 'LAST_MONTH', label: '上个月' },
];

function getTransactionDateRange(dimension: TransactionTimeFilterValue): { start: Date; end: Date } | null {
  const today = new Date();
  const todayStart = startOfDay(today);
  const yesterday = subDays(todayStart, 1);

  switch (dimension) {
    case 'TODAY':
      return { start: todayStart, end: endOfDay(today) };
    case 'YESTERDAY':
      return { start: yesterday, end: endOfDay(yesterday) };
    case 'LAST_7_DAYS':
      return { start: subDays(todayStart, 7), end: endOfDay(yesterday) };
    case 'LAST_30_DAYS':
      return { start: subDays(todayStart, 30), end: endOfDay(yesterday) };
    case 'THIS_MONTH':
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'LAST_MONTH':
      const lastMonthStart = startOfMonth(subMonths(today, 1));
      return { start: lastMonthStart, end: endOfMonth(lastMonthStart) };
    case 'ALL':
    default:
      return null;
  }
}


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
  const { transactions, isLoadingTransactions } = useInventory();
  const [hasMounted, setHasMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeDimension, setSelectedTimeDimension] = useState<TransactionTimeFilterValue>('ALL');

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setSelectedTimeDimension('ALL'); // Clear dimension filter if a specific date is picked
    }
  };

  const handleTimeDimensionSelect = (value: string) => {
    const dimension = value as TransactionTimeFilterValue;
    setSelectedTimeDimension(dimension);
    if (dimension !== 'ALL') {
      setSelectedDate(undefined); // Clear date filter if a dimension is picked
    }
  };
  
  const clearFilters = () => {
    setSelectedDate(undefined);
    setSelectedTimeDimension('ALL');
  };

  const filteredTransactions = useMemo(() => {
    if (!hasMounted) return [];
    let items = [...transactions];

    if (selectedDate) {
      items = items.filter(t => isSameDay(parseISO(t.timestamp), selectedDate));
    } else if (selectedTimeDimension !== 'ALL') {
      const range = getTransactionDateRange(selectedTimeDimension);
      if (range) {
        items = items.filter(t => isWithinInterval(parseISO(t.timestamp), { start: range.start, end: range.end }));
      }
    }
    
    return items.sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime());
  }, [transactions, selectedDate, selectedTimeDimension, hasMounted]);


  if (!hasMounted || isLoadingTransactions) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            交易记录
          </h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto" disabled><CalendarIcon className="mr-2 h-4 w-4" /> 日期筛选</Button>
            <Button variant="outline" className="w-full sm:w-auto" disabled><Filter className="mr-2 h-4 w-4" /> 时间范围</Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>所有交易明细</CardTitle>
            <CardDescription>按时间从新到旧排序。包括所有产品的入库和出库记录。</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-muted-foreground">正在加载交易记录...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          交易记录
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-full sm:min-w-[240px] justify-start text-left font-normal h-10",
                    !selectedDate && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP", {locale: zhCN}) : <span>按日期筛选</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    locale={zhCN}
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    initialFocus
                />
                </PopoverContent>
            </Popover>

            <Select value={selectedTimeDimension} onValueChange={handleTimeDimensionSelect}>
                <SelectTrigger className="w-full sm:min-w-[200px] h-10">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="按时间范围筛选" />
                </SelectTrigger>
                <SelectContent>
                    {TIME_FILTER_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {(selectedDate || selectedTimeDimension !== 'ALL') && (
                 <Button variant="ghost" onClick={clearFilters} className="h-10 px-3" title="清除筛选">
                    <X className="h-4 w-4" />
                 </Button>
            )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>交易明细</CardTitle>
          <CardDescription>
            {selectedDate ? `显示 ${format(selectedDate, "yyyy年M月d日", {locale: zhCN})} 的记录。` : 
             selectedTimeDimension !== 'ALL' ? `显示 ${TIME_FILTER_OPTIONS.find(opt => opt.value === selectedTimeDimension)?.label || ''} 的记录。` :
            '按时间从新到旧排序。包括所有产品的入库和出库记录。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <ScrollArea className="h-[60vh] sm:h-[65vh]">
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
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatTransactionType(transaction.type, transaction.isCorrectionIncrease)}</TableCell>
                      <TableCell>{transaction.productName}</TableCell>
                      <TableCell className="text-right">
                        {transaction.isCorrectionIncrease ? `+${transaction.quantity}` : (transaction.type === 'IN' ? `+${transaction.quantity}` : `-${transaction.quantity}`)}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.unitCostAtTransaction !== undefined && transaction.unitCostAtTransaction !== null ? `¥${transaction.unitCostAtTransaction.toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        {transaction.unitCostAtTransaction !== undefined && transaction.unitCostAtTransaction !== null ? `¥${(transaction.quantity * transaction.unitCostAtTransaction).toFixed(2)}` : 'N/A'}
                      </TableCell>
                      <TableCell>{transaction.type === 'OUT' ? formatOutflowReason(transaction.reason) : 'N/A'}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={transaction.notes || undefined}>{transaction.notes || 'N/A'}</TableCell>
                      <TableCell className="text-xs truncate max-w-[100px]" title={transaction.batchId || undefined}>{transaction.batchId || 'N/A'}</TableCell>
                      <TableCell className="text-xs">{format(parseISO(transaction.timestamp), "yyyy-MM-dd HH:mm:ss", { locale: zhCN })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              <History className="mx-auto h-12 w-12 mb-4" />
              <p>{selectedDate || selectedTimeDimension !== 'ALL' ? '在选定的日期/范围内未找到交易记录。' : '暂无交易记录。'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

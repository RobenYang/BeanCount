import { StockOutflowForm } from '@/components/forms/StockOutflowForm';

export default function StockOutflowPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">记录出库</h1>
      <StockOutflowForm />
    </div>
  );
}

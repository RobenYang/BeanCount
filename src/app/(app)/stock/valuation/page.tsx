import { StockValuationForm } from '@/components/forms/StockValuationForm';

export default function StockValuationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">库存估值摘要</h1>
      <StockValuationForm />
    </div>
  );
}

import { StockValuationForm } from '@/components/forms/StockValuationForm';

export default function StockValuationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Stock Valuation Summary</h1>
      <StockValuationForm />
    </div>
  );
}

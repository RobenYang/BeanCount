import { StockIntakeForm } from '@/components/forms/StockIntakeForm';

export default function StockIntakePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Record Stock Intake</h1>
      <StockIntakeForm />
    </div>
  );
}

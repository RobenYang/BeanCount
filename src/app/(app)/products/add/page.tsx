import { AddProductForm } from '@/components/forms/AddProductForm';

export default function AddProductPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">添加新产品</h1>
      <AddProductForm />
    </div>
  );
}

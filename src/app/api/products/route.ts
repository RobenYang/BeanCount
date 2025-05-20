'use server';
import { NextResponse } from 'next/server';
import type { Product } from '@/lib/types';
import { nanoid } from 'nanoid';

// In-memory store for demonstration purposes ONLY.
// In a real app, this would be a database.
// Data will be lost if the server restarts or scales.
let productsStore: Product[] = [
    { id: 'api_sample_prod_1', name: '阿拉比卡咖啡豆 (来自API)', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365, lowStockThreshold: 2, createdAt: new Date().toISOString(), isArchived: false, imageUrl: 'https://placehold.co/300x300.png?text=豆API' },
    { id: 'api_sample_prod_2', name: '全脂牛奶 (来自API)', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7, lowStockThreshold: 3, createdAt: new Date().toISOString(), isArchived: false, imageUrl: 'https://placehold.co/300x300.png?text=奶API' },
    { id: 'api_sample_prod_3', name: '马克杯 (来自API)', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null, lowStockThreshold: 5, createdAt: new Date().toISOString(), isArchived: false, imageUrl: 'https://placehold.co/300x300.png?text=杯API' },
];

export async function GET() {
  // In a real app, you would fetch data from your database here.
  // Simulate a short delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return NextResponse.json(productsStore);
}

export async function POST(request: Request) {
  try {
    const productData = await request.json() as Omit<Product, 'id' | 'createdAt' | 'isArchived'>;
    
    // Basic validation (in a real app, use Zod or a similar library)
    if (!productData.name || !productData.category || !productData.unit || productData.lowStockThreshold === undefined) {
      return NextResponse.json({ error: 'Missing required product fields' }, { status: 400 });
    }
    // Ensure shelfLifeDays is null if not INGREDIENT
    const shelfLifeDays = productData.category === 'INGREDIENT' ? (productData.shelfLifeDays || 0) : null;


    const newProduct: Product = {
      ...productData,
      shelfLifeDays, // use processed shelfLifeDays
      id: nanoid(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    
    // In a real app, you would save the new product to your database here.
    productsStore.push(newProduct);
    
    // Simulate a short delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Failed to create product via API:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

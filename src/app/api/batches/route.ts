
'use server';
import { NextResponse } from 'next/server';
import type { Batch, Product } from '@/lib/types';
import { nanoid } from 'nanoid';
import { addDays, formatISO, parseISO } from 'date-fns';

// In-memory store for demonstration purposes ONLY for batches.
// Data will be lost if the server restarts or scales.
// This should be replaced with a real database.
let batchesStore: Batch[] = [
    // Initial sample batches can be added here if needed,
    // but it's often better to let the client POST them after products are loaded.
];

// Placeholder: In a real app, you'd fetch products from a DB or product service.
// For now, we'll use a simplified product list. This should ideally be shared
// with the products API or fetched from the same source.
const getProductById_API_INTERNAL = (productId: string): Partial<Product> | undefined => {
    // This is a simplified placeholder. In a real scenario, you would query your product database.
    // For now, we'll simulate a few known products for batch creation.
    const knownProducts: Partial<Product>[] = [
        { id: 'api_sample_prod_1', name: '阿拉比卡咖啡豆 (来自API)', category: 'INGREDIENT', unit: 'kg', shelfLifeDays: 365 },
        { id: 'api_sample_prod_2', name: '全脂牛奶 (来自API)', category: 'INGREDIENT', unit: '升', shelfLifeDays: 7 },
        { id: 'api_sample_prod_3', name: '马克杯 (来自API)', category: 'NON_INGREDIENT', unit: '个', shelfLifeDays: null },
    ];
    return knownProducts.find(p => p.id === productId);
}


export async function GET() {
  // Simulate a short delay
  await new Promise(resolve => setTimeout(resolve, 400));
  return NextResponse.json(batchesStore);
}

export async function POST(request: Request) {
  try {
    const batchData = await request.json() as Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null };
    
    const product = getProductById_API_INTERNAL(batchData.productId);
    if (!product || !product.name || !product.category || !product.shelfLifeDays === undefined ) { // ensure essential product props exist
      return NextResponse.json({ error: 'Associated product not found or product data incomplete for batch creation' }, { status: 400 });
    }

    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      return NextResponse.json({ error: 'Valid unit cost is required for batch' }, { status: 400 });
    }
    if (batchData.initialQuantity <= 0) {
      return NextResponse.json({ error: 'Initial quantity must be greater than 0' }, { status: 400 });
    }

    const batchCreatedAt = formatISO(new Date());
    let productionDateIso: string | null = null;
    let expiryDateIso: string | null = null;

    if (product.category === 'INGREDIENT') {
      if (!batchData.productionDate) {
        return NextResponse.json({ error: 'Production date is required for ingredient products' }, { status: 400 });
      }
      try {
        productionDateIso = formatISO(parseISO(batchData.productionDate)); // Validate and reformat
        if (product.shelfLifeDays && product.shelfLifeDays > 0) {
          expiryDateIso = formatISO(addDays(parseISO(batchData.productionDate), product.shelfLifeDays));
        }
      } catch (e) {
        return NextResponse.json({ error: 'Invalid production date format' }, { status: 400 });
      }
    } else { // NON_INGREDIENT
      productionDateIso = batchData.productionDate ? formatISO(parseISO(batchData.productionDate)) : batchCreatedAt;
      expiryDateIso = null;
    }

    const newBatch: Batch = {
      id: nanoid(),
      productId: batchData.productId,
      productName: product.name, // Denormalize product name
      productionDate: productionDateIso,
      expiryDate: expiryDateIso,
      initialQuantity: batchData.initialQuantity,
      currentQuantity: batchData.initialQuantity, // Initially current quantity is the same as initial
      unitCost: batchData.unitCost,
      createdAt: batchCreatedAt,
    };
    
    batchesStore.push(newBatch);
    
    // Simulate a short delay
    await new Promise(resolve => setTimeout(resolve, 200));
    return NextResponse.json(newBatch, { status: 201 });

  } catch (error) {
    console.error('Failed to create batch via API:', error);
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
  }
}

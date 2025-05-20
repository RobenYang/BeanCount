
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Product } from '@/lib/types';

// GET /api/products/[productId] - Optional: if needed to fetch a single product
export async function GET(request: Request, { params }: { params: { productId: string } }) {
  const { productId } = params;
  try {
    const { rows } = await sql`
      SELECT 
        id, name, category, unit, 
        shelf_life_days AS "shelfLifeDays", 
        low_stock_threshold AS "lowStockThreshold", 
        image_url AS "imageUrl", 
        created_at AS "createdAt", 
        is_archived AS "isArchived"
      FROM products 
      WHERE id = ${productId};
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(`Failed to fetch product ${productId} from Postgres:`, error);
    return NextResponse.json({ error: `Failed to fetch product ${productId}` }, { status: 500 });
  }
}

// PUT /api/products/[productId] - To update product details
export async function PUT(request: Request, { params }: { params: { productId: string } }) {
  const { productId } = params;
  try {
    const { name, unit, shelfLifeDays, lowStockThreshold, imageUrl } = await request.json() as Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>;

    // Basic validation
    if (!name || !unit || lowStockThreshold === undefined) {
      return NextResponse.json({ error: 'Missing required fields for product update (name, unit, lowStockThreshold)' }, { status: 400 });
    }
    
    // Fetch current product to know its category (category is not updatable via this endpoint)
    const currentProductResult = await sql`SELECT category FROM products WHERE id = ${productId}`;
    if (currentProductResult.rows.length === 0) {
        return NextResponse.json({ error: 'Product not found for category check' }, { status: 404 });
    }
    const category = currentProductResult.rows[0].category;

    const shelfLifeDaysForDb = category === 'INGREDIENT' ? (shelfLifeDays || 0) : null;


    const result = await sql`
      UPDATE products
      SET 
        name = ${name}, 
        unit = ${unit}, 
        shelf_life_days = ${shelfLifeDaysForDb}, 
        low_stock_threshold = ${lowStockThreshold}, 
        image_url = ${imageUrl || null}
      WHERE id = ${productId}
      RETURNING 
        id, name, category, unit, 
        shelf_life_days AS "shelfLifeDays", 
        low_stock_threshold AS "lowStockThreshold", 
        image_url AS "imageUrl", 
        created_at AS "createdAt", 
        is_archived AS "isArchived";
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found or no update made' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(`Failed to update product ${productId} in Postgres:`, error);
    return NextResponse.json({ error: `Failed to update product ${productId}` }, { status: 500 });
  }
}

// PATCH /api/products/[productId] - To archive/unarchive a product
export async function PATCH(request: Request, { params }: { params: { productId: string } }) {
  const { productId } = params;
  try {
    const { isArchived } = await request.json() as { isArchived: boolean };

    if (typeof isArchived !== 'boolean') {
      return NextResponse.json({ error: 'isArchived field (boolean) is required' }, { status: 400 });
    }

    const result = await sql`
      UPDATE products
      SET is_archived = ${isArchived}
      WHERE id = ${productId}
      RETURNING 
        id, name, category, unit, 
        shelf_life_days AS "shelfLifeDays", 
        low_stock_threshold AS "lowStockThreshold", 
        image_url AS "imageUrl", 
        created_at AS "createdAt", 
        is_archived AS "isArchived";
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found or no update made' }, { status: 404 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error(`Failed to update archive status for product ${productId} in Postgres:`, error);
    return NextResponse.json({ error: `Failed to update archive status for product ${productId}` }, { status: 500 });
  }
}

// DELETE /api/products/[productId] - Optional: if hard delete is ever needed
// For now, we use soft delete (archiving)
export async function DELETE(request: Request, { params }: { params: { productId: string } }) {
  const { productId } = params;
  // Example: Hard delete (use with caution, ensure batches/transactions are handled)
  // try {
  //   await sql`DELETE FROM products WHERE id = ${productId};`;
  //   return NextResponse.json({ message: `Product ${productId} deleted successfully` });
  // } catch (error) {
  //   console.error(`Failed to delete product ${productId} from Postgres:`, error);
  //   return NextResponse.json({ error: `Failed to delete product ${productId}` }, { status: 500 });
  // }
  return NextResponse.json({ message: 'Hard delete not implemented. Use PATCH to archive/unarchive.' }, { status: 405 });
}

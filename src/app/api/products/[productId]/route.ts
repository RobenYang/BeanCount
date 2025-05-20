
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Product } from '@/lib/types';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const apiKey = process.env.API_SECRET_KEY;

  if (!apiKey) {
    console.warn("API_SECRET_KEY is not set. Skipping authentication. THIS IS INSECURE FOR PRODUCTION.");
    return true;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === apiKey;
  }
  return false;
}

export async function GET(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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

export async function PUT(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { productId } = params;
  try {
    const { name, unit, shelfLifeDays, lowStockThreshold, imageUrl } = await request.json() as Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>;

    if (!name || !unit || lowStockThreshold === undefined) {
      return NextResponse.json({ error: 'Missing required fields for product update (name, unit, lowStockThreshold)' }, { status: 400 });
    }
    
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

export async function PATCH(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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

export async function DELETE(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // const { productId } = params;
  // Hard delete not implemented.
  return NextResponse.json({ message: 'Hard delete not implemented. Use PATCH to archive/unarchive.' }, { status: 405 });
}

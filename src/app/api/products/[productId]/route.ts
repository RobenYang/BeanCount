
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Product } from '@/lib/types';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const apiKey = process.env.API_SECRET_KEY;

  if (!apiKey) {
    console.warn("API_SECRET_KEY is not set. API authentication is bypassed for this request. THIS IS INSECURE FOR PRODUCTION if API_SECRET_KEY is intended to be used.");
    return true;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === apiKey;
  }
  console.warn("API Authentication failed: Missing or invalid Authorization header.");
  return false;
}

export async function GET(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { productId } = params;

  if (!process.env.POSTGRES_URL) {
    console.warn(`POSTGRES_URL is not set. Running in DB-less local development mode for GET /api/products/${productId}. Returning not found.`);
    // In dev mode without DB, we can't find a specific product, so 404 is appropriate.
    return NextResponse.json({ error: 'Product not found in DB-less dev mode' }, { status: 404 });
  }

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
    return NextResponse.json({ error: `Failed to fetch product ${productId}`, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { productId } = params;
  let productData: Partial<Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'category'>>;
  try {
    productData = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  
  if (!process.env.POSTGRES_URL) {
    console.warn(`POSTGRES_URL is not set. Running in DB-less local development mode for PUT /api/products/${productId}. Simulating update.`);
    // Simulate finding and returning an updated product for dev mode
    const mockUpdatedProduct: Product = {
        id: productId,
        name: productData.name || "Dev Product Name",
        category: "INGREDIENT", // Mock category, actual category isn't updatable via this form
        unit: productData.unit || "unit",
        shelfLifeDays: productData.shelfLifeDays !== undefined ? productData.shelfLifeDays : 0,
        lowStockThreshold: productData.lowStockThreshold !== undefined ? productData.lowStockThreshold : 0,
        imageUrl: productData.imageUrl || null,
        createdAt: new Date().toISOString(),
        isArchived: false, // Assuming not changing archive status here
    };
    return NextResponse.json(mockUpdatedProduct);
  }

  try {
    const { name, unit, shelfLifeDays, lowStockThreshold, imageUrl } = productData;

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
    return NextResponse.json({ error: `Failed to update product ${productId}`, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { productId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { productId } = params;
  let payload: { isArchived: boolean };
  try {
    payload = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload for PATCH' }, { status: 400 });
  }
  const { isArchived } = payload;


  if (!process.env.POSTGRES_URL) {
    console.warn(`POSTGRES_URL is not set. Running in DB-less local development mode for PATCH /api/products/${productId}. Simulating archive/unarchive.`);
    // Simulate finding and returning an updated product for dev mode
     const mockPatchedProduct: Product = {
        id: productId,
        name: "Dev Product Name (Patched)",
        category: "INGREDIENT",
        unit: "unit",
        shelfLifeDays: 0,
        lowStockThreshold: 0,
        imageUrl: null,
        createdAt: new Date().toISOString(),
        isArchived: isArchived, 
    };
    return NextResponse.json(mockPatchedProduct);
  }

  try {
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
    return NextResponse.json({ error: `Failed to update archive status for product ${productId}`, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
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

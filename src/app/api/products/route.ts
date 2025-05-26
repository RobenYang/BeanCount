
'use server';
import { NextResponse } from 'next/server';
import type { Product } from '@/lib/types';
import { nanoid } from 'nanoid';
import { sql } from '@vercel/postgres';

// Example 'products' table schema (SQL):
// CREATE TABLE products (
//     id TEXT PRIMARY KEY,
//     name TEXT NOT NULL,
//     category TEXT NOT NULL, -- 'INGREDIENT' or 'NON_INGREDIENT'
//     unit TEXT NOT NULL,
//     shelf_life_days INTEGER, -- Nullable for NON_INGREDIENT
//     -- low_stock_threshold INTEGER NOT NULL, // This column should be removed from DB
//     image_url TEXT,
//     created_at TIMESTAMPTZ NOT NULL,
//     is_archived BOOLEAN NOT NULL DEFAULT FALSE
// );

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

export async function GET(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for GET /api/products. Returning empty array.");
    return NextResponse.json([]);
  }

  try {
    const { rows } = await sql<Omit<Product, 'lowStockThreshold'>>`
      SELECT 
        id, 
        name, 
        category, 
        unit, 
        shelf_life_days AS "shelfLifeDays", 
        -- low_stock_threshold AS "lowStockThreshold", -- Removed
        image_url AS "imageUrl", 
        created_at AS "createdAt", 
        is_archived AS "isArchived" 
      FROM products 
      ORDER BY created_at DESC;
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch products from Postgres:', error);
    return NextResponse.json({ error: 'Failed to fetch products', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let productData: Omit<Product, 'id' | 'createdAt' | 'isArchived' | 'lowStockThreshold'>; // Ensure lowStockThreshold is NOT expected
  try {
    productData = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  // Validation for required fields 
  if (!productData.name || !productData.category || !productData.unit ) {
    return NextResponse.json({ error: 'Missing required product fields (name, category, unit are required)' }, { status: 400 });
  }
  // No validation for lowStockThreshold as it's removed


  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for POST /api/products. Simulating product creation.");
    const newProduct: Product = {
      ...(productData as Omit<Product, 'id' | 'createdAt' | 'isArchived'>), // Cast to ensure all fields are there, then add new ones
      id: `dev-${nanoid()}`,
      createdAt: new Date().toISOString(),
      isArchived: false,
      shelfLifeDays: productData.category === 'INGREDIENT' ? (productData.shelfLifeDays || 0) : null,
      imageUrl: productData.imageUrl || null,
    };
    return NextResponse.json(newProduct, { status: 201 });
  }
  
  try {
    const shelfLifeDays = productData.category === 'INGREDIENT' ? (productData.shelfLifeDays || 0) : null;
    const id = nanoid();
    const createdAt = new Date().toISOString();
    const isArchived = false;
    const imageUrl = productData.imageUrl || null;

    await sql`
      INSERT INTO products (id, name, category, unit, shelf_life_days, image_url, created_at, is_archived)
      VALUES (
        ${id}, 
        ${productData.name}, 
        ${productData.category}, 
        ${productData.unit}, 
        ${shelfLifeDays}, 
        ${imageUrl}, 
        ${createdAt}, 
        ${isArchived}
      );
    `;
    
    const newProduct: Product = {
      name: productData.name,
      category: productData.category,
      unit: productData.unit,
      shelfLifeDays,
      imageUrl,
      id,
      createdAt,
      isArchived,
    };
    
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Failed to create product in Postgres:', error);
    return NextResponse.json({ error: 'Failed to create product', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

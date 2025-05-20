
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
//     low_stock_threshold INTEGER NOT NULL,
//     image_url TEXT,
//     created_at TIMESTAMPTZ NOT NULL,
//     is_archived BOOLEAN NOT NULL DEFAULT FALSE
// );

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const apiKey = process.env.API_SECRET_KEY;

  if (!apiKey) {
    // If API_SECRET_KEY is not set on the server, bypass auth for local dev or misconfiguration
    // WARNING: In production, ensure API_SECRET_KEY is always set.
    console.warn("API_SECRET_KEY is not set. Skipping authentication. THIS IS INSECURE FOR PRODUCTION.");
    return true;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove "Bearer "
    return token === apiKey;
  }
  return false;
}

export async function GET(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { rows } = await sql`
      SELECT 
        id, 
        name, 
        category, 
        unit, 
        shelf_life_days AS "shelfLifeDays", 
        low_stock_threshold AS "lowStockThreshold", 
        image_url AS "imageUrl", 
        created_at AS "createdAt", 
        is_archived AS "isArchived" 
      FROM products 
      ORDER BY created_at DESC;
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch products from Postgres:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const productData = await request.json() as Omit<Product, 'id' | 'createdAt' | 'isArchived'>;
    
    if (!productData.name || !productData.category || !productData.unit || productData.lowStockThreshold === undefined) {
      return NextResponse.json({ error: 'Missing required product fields' }, { status: 400 });
    }
    
    const shelfLifeDays = productData.category === 'INGREDIENT' ? (productData.shelfLifeDays || 0) : null;
    const id = nanoid();
    const createdAt = new Date().toISOString();
    const isArchived = false;
    const imageUrl = productData.imageUrl || null;

    await sql`
      INSERT INTO products (id, name, category, unit, shelf_life_days, low_stock_threshold, image_url, created_at, is_archived)
      VALUES (
        ${id}, 
        ${productData.name}, 
        ${productData.category}, 
        ${productData.unit}, 
        ${shelfLifeDays}, 
        ${productData.lowStockThreshold}, 
        ${imageUrl}, 
        ${createdAt}, 
        ${isArchived}
      );
    `;
    
    const newProduct: Product = {
      name: productData.name,
      category: productData.category,
      unit: productData.unit,
      lowStockThreshold: productData.lowStockThreshold,
      shelfLifeDays,
      imageUrl,
      id,
      createdAt,
      isArchived,
    };
    
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Failed to create product in Postgres:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

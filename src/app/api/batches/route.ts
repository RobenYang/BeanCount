
'use server';
import { NextResponse } from 'next/server';
import type { Batch, Product } from '@/lib/types';
import { nanoid } from 'nanoid';
import { addDays, formatISO, parseISO } from 'date-fns';
import { sql } from '@vercel/postgres';

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

async function getProductFromDB(productId: string): Promise<Partial<Product> | null> {
  try {
    const { rows } = await sql`
      SELECT id, name, category, unit, shelf_life_days AS "shelfLifeDays" 
      FROM products 
      WHERE id = ${productId};
    `;
    if (rows.length > 0) {
      return rows[0] as Partial<Product>;
    }
    return null;
  } catch (error) {
    console.error('Error fetching product from DB in batches API:', error);
    return null;
  }
}

export async function GET(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { rows } = await sql`
      SELECT 
        id, 
        product_id AS "productId", 
        product_name AS "productName", 
        production_date AS "productionDate", 
        expiry_date AS "expiryDate", 
        initial_quantity AS "initialQuantity", 
        current_quantity AS "currentQuantity", 
        unit_cost AS "unitCost", 
        created_at AS "createdAt"
      FROM batches 
      ORDER BY created_at DESC;
    `;
    const formattedRows = rows.map(row => ({
      ...row,
      productionDate: row.productionDate ? formatISO(new Date(row.productionDate)) : null,
      expiryDate: row.expiryDate ? formatISO(new Date(row.expiryDate)) : null,
      createdAt: row.createdAt ? formatISO(new Date(row.createdAt)) : null,
    }));
    return NextResponse.json(formattedRows);
  } catch (error) {
    console.error('Failed to fetch batches from Postgres:', error);
    return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const batchData = await request.json() as Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null };
    
    const product = await getProductFromDB(batchData.productId);
    if (!product || !product.name || !product.category || product.shelfLifeDays === undefined) {
      return NextResponse.json({ error: 'Associated product not found or product data incomplete for batch creation' }, { status: 400 });
    }

    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      return NextResponse.json({ error: 'Valid unit cost is required for batch' }, { status: 400 });
    }
    if (batchData.initialQuantity <= 0) {
      return NextResponse.json({ error: 'Initial quantity must be greater than 0' }, { status: 400 });
    }

    const batchId = nanoid();
    const batchCreatedAt = new Date();
    let productionDateForDb: Date | null = null;
    let expiryDateForDb: Date | null = null;

    if (product.category === 'INGREDIENT') {
      if (!batchData.productionDate) {
        return NextResponse.json({ error: 'Production date is required for ingredient products' }, { status: 400 });
      }
      try {
        productionDateForDb = parseISO(batchData.productionDate);
        if (product.shelfLifeDays && product.shelfLifeDays > 0) {
          expiryDateForDb = addDays(productionDateForDb, product.shelfLifeDays);
        }
      } catch (e) {
        return NextResponse.json({ error: 'Invalid production date format' }, { status: 400 });
      }
    } else {
      productionDateForDb = batchData.productionDate ? parseISO(batchData.productionDate) : batchCreatedAt;
    }

    await sql`
      INSERT INTO batches (
        id, product_id, product_name, 
        production_date, expiry_date, 
        initial_quantity, current_quantity, 
        unit_cost, created_at
      )
      VALUES (
        ${batchId}, ${batchData.productId}, ${product.name},
        ${productionDateForDb ? productionDateForDb.toISOString() : null}, 
        ${expiryDateForDb ? expiryDateForDb.toISOString() : null},
        ${batchData.initialQuantity}, ${batchData.initialQuantity}, 
        ${batchData.unitCost}, ${batchCreatedAt.toISOString()}
      );
    `;
    
    const newBatch: Batch = {
      id: batchId,
      productId: batchData.productId,
      productName: product.name,
      productionDate: productionDateForDb ? formatISO(productionDateForDb) : null,
      expiryDate: expiryDateForDb ? formatISO(expiryDateForDb) : null,
      initialQuantity: batchData.initialQuantity,
      currentQuantity: batchData.initialQuantity,
      unitCost: batchData.unitCost,
      createdAt: formatISO(batchCreatedAt),
    };
    
    return NextResponse.json(newBatch, { status: 201 });

  } catch (error) {
    console.error('Failed to create batch in Postgres:', error);
    return NextResponse.json({ error: 'Failed to create batch' }, { status: 500 });
  }
}

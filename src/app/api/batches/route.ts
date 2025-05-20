
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

async function getProductFromDB(productId: string): Promise<Partial<Product> | null> {
  if (!process.env.POSTGRES_URL) {
    // In DB-less dev mode, we can't fetch from a real DB. Return a mock or null.
    console.warn(`DB-less mode: Mocking product fetch for product ID ${productId} in getProductFromDB.`);
    return { id: productId, name: `Dev Product ${productId}`, category: 'INGREDIENT', shelfLifeDays: 30 }; // Example mock
  }
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
    return null; // Or rethrow, depending on desired error handling
  }
}

export async function GET(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for GET /api/batches. Returning empty array.");
    return NextResponse.json([]);
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
    return NextResponse.json({ error: 'Failed to fetch batches', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let batchData: Omit<Batch, 'id' | 'expiryDate' | 'createdAt' | 'currentQuantity' | 'productName'> & { productionDate: string | null };
  try {
    batchData = await request.json();
  } catch(e){
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  
  const batchId = nanoid();
  const batchCreatedAt = new Date();
  let productionDateForDb: Date | null = null;
  let expiryDateForDb: Date | null = null;


  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for POST /api/batches. Simulating batch creation.");
    // Simulate product fetch for dev mode
    const product = { name: `Dev Product ${batchData.productId}`, category: 'INGREDIENT', shelfLifeDays: 30 }; // Mock product
    if (product.category === 'INGREDIENT') {
        if (batchData.productionDate) productionDateForDb = parseISO(batchData.productionDate);
        if (productionDateForDb && product.shelfLifeDays && product.shelfLifeDays > 0) {
            expiryDateForDb = addDays(productionDateForDb, product.shelfLifeDays);
        }
    } else {
        productionDateForDb = batchData.productionDate ? parseISO(batchData.productionDate) : batchCreatedAt;
    }
    const newBatch: Batch = {
      id: `dev-${batchId}`,
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
  }

  try {
    const product = await getProductFromDB(batchData.productId);
    if (!product || !product.name || !product.category || product.shelfLifeDays === undefined) {
      // If product.shelfLifeDays is null for NON_INGREDIENT, it's okay. Check if it's undefined for INGREDIENT
      if (product && product.category === 'INGREDIENT' && product.shelfLifeDays === undefined) {
         return NextResponse.json({ error: 'Associated ingredient product data incomplete (shelfLifeDays missing) for batch creation' }, { status: 400 });
      } else if (!product) {
         return NextResponse.json({ error: 'Associated product not found for batch creation' }, { status: 400 });
      }
    }
    
    if (batchData.unitCost === undefined || batchData.unitCost < 0) {
      return NextResponse.json({ error: 'Valid unit cost is required for batch' }, { status: 400 });
    }
    if (batchData.initialQuantity <= 0) {
      return NextResponse.json({ error: 'Initial quantity must be greater than 0' }, { status: 400 });
    }


    if (product.category === 'INGREDIENT') {
      if (!batchData.productionDate) {
        return NextResponse.json({ error: 'Production date is required for ingredient products' }, { status: 400 });
      }
      try {
        productionDateForDb = parseISO(batchData.productionDate);
        // Ensure shelfLifeDays is a number for ingredients before using it
        if (product.shelfLifeDays !== null && product.shelfLifeDays > 0) { 
          expiryDateForDb = addDays(productionDateForDb, product.shelfLifeDays);
        }
      } catch (e) {
        return NextResponse.json({ error: 'Invalid production date format' }, { status: 400 });
      }
    } else { // NON_INGREDIENT
      productionDateForDb = batchData.productionDate ? parseISO(batchData.productionDate) : batchCreatedAt;
      // expiryDateForDb remains null for non-ingredients
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
      productName: product.name!, // Product name is now confirmed to exist if product was found
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
    return NextResponse.json({ error: 'Failed to create batch', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

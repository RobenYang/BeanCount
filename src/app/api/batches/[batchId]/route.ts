
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Batch } from '@/lib/types';
import { formatISO } from 'date-fns';

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

export async function GET(request: Request, { params }: { params: { batchId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { batchId } = params;

  if (!process.env.POSTGRES_URL) {
    console.warn(`POSTGRES_URL is not set. Running in DB-less local development mode for GET /api/batches/${batchId}. Returning not found.`);
    return NextResponse.json({ error: 'Batch not found in DB-less dev mode' }, { status: 404 });
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
      WHERE id = ${batchId};
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }
    const batch = rows[0] as Batch;
    const formattedBatch = {
      ...batch,
      productionDate: batch.productionDate ? formatISO(new Date(batch.productionDate)) : null,
      expiryDate: batch.expiryDate ? formatISO(new Date(batch.expiryDate)) : null,
      createdAt: batch.createdAt ? formatISO(new Date(batch.createdAt)) : null,
    };
    return NextResponse.json(formattedBatch);
  } catch (error) {
    console.error(`Failed to fetch batch ${batchId} from Postgres:`, error);
    return NextResponse.json({ error: `Failed to fetch batch ${batchId}`, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { batchId: string } }) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { batchId } = params;
  let payload: { currentQuantity?: number };
  try {
    payload = await request.json();
  } catch(e){
     return NextResponse.json({ error: 'Invalid JSON payload for PUT' }, { status: 400 });
  }
  const { currentQuantity } = payload;

  if (!process.env.POSTGRES_URL) {
    console.warn(`POSTGRES_URL is not set. Running in DB-less local development mode for PUT /api/batches/${batchId}. Simulating update.`);
    const mockUpdatedBatch: Partial<Batch> = { // Return partial as we don't have full original batch
        id: batchId,
        currentQuantity: currentQuantity !== undefined ? currentQuantity : 0, 
    };
    return NextResponse.json(mockUpdatedBatch);
  }


  try {
    if (currentQuantity === undefined || typeof currentQuantity !== 'number' || currentQuantity < 0) {
      return NextResponse.json({ error: 'Valid currentQuantity is required and must be non-negative.' }, { status: 400 });
    }

    const result = await sql`
      UPDATE batches
      SET current_quantity = ${currentQuantity}
      WHERE id = ${batchId}
      RETURNING 
        id, 
        product_id AS "productId", 
        product_name AS "productName", 
        production_date AS "productionDate", 
        expiry_date AS "expiryDate", 
        initial_quantity AS "initialQuantity", 
        current_quantity AS "currentQuantity", 
        unit_cost AS "unitCost", 
        created_at AS "createdAt";
    `;

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Batch not found or no update made' }, { status: 404 });
    }
    
    const updatedBatch = result.rows[0] as Batch;
    const formattedBatch = {
      ...updatedBatch,
      productionDate: updatedBatch.productionDate ? formatISO(new Date(updatedBatch.productionDate)) : null,
      expiryDate: updatedBatch.expiryDate ? formatISO(new Date(updatedBatch.expiryDate)) : null,
      createdAt: updatedBatch.createdAt ? formatISO(new Date(updatedBatch.createdAt)) : null,
    };

    return NextResponse.json(formattedBatch);
  } catch (error) {
    console.error(`Failed to update batch ${batchId} in Postgres:`, error);
    return NextResponse.json({ error: `Failed to update batch ${batchId}`, details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

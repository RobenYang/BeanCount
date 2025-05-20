
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { Batch } from '@/lib/types';
import { formatISO } from 'date-fns';

// GET /api/batches/[batchId] - Optional: if needed to fetch a single batch
export async function GET(request: Request, { params }: { params: { batchId: string } }) {
  const { batchId } = params;
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
    // Ensure date fields are correctly formatted as ISO strings
    const formattedBatch = {
      ...batch,
      productionDate: batch.productionDate ? formatISO(new Date(batch.productionDate)) : null,
      expiryDate: batch.expiryDate ? formatISO(new Date(batch.expiryDate)) : null,
      createdAt: batch.createdAt ? formatISO(new Date(batch.createdAt)) : null,
    };
    return NextResponse.json(formattedBatch);
  } catch (error) {
    console.error(`Failed to fetch batch ${batchId} from Postgres:`, error);
    return NextResponse.json({ error: `Failed to fetch batch ${batchId}` }, { status: 500 });
  }
}


// PUT /api/batches/[batchId] - To update batch details, specifically currentQuantity
export async function PUT(request: Request, { params }: { params: { batchId: string } }) {
  const { batchId } = params;
  try {
    const { currentQuantity } = await request.json() as Partial<Pick<Batch, 'currentQuantity'>>;

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
    // Ensure date fields are correctly formatted as ISO strings
    const formattedBatch = {
      ...updatedBatch,
      productionDate: updatedBatch.productionDate ? formatISO(new Date(updatedBatch.productionDate)) : null,
      expiryDate: updatedBatch.expiryDate ? formatISO(new Date(updatedBatch.expiryDate)) : null,
      createdAt: updatedBatch.createdAt ? formatISO(new Date(updatedBatch.createdAt)) : null,
    };

    return NextResponse.json(formattedBatch);
  } catch (error) {
    console.error(`Failed to update batch ${batchId} in Postgres:`, error);
    return NextResponse.json({ error: `Failed to update batch ${batchId}` }, { status: 500 });
  }
}
    
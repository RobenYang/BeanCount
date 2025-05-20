
'use server';
import { NextResponse } from 'next/server';
import type { Transaction } from '@/lib/types';
import { sql } from '@vercel/postgres';
import { nanoid } from 'nanoid';
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

export async function GET(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for GET /api/transactions. Returning empty array.");
    return NextResponse.json([]);
  }

  try {
    const { rows } = await sql`
      SELECT 
        id, 
        product_id AS "productId", 
        product_name AS "productName",
        batch_id AS "batchId",
        type, 
        quantity, 
        timestamp, 
        reason, 
        notes,
        unit_cost_at_transaction AS "unitCostAtTransaction",
        is_correction_increase AS "isCorrectionIncrease"
      FROM transactions 
      ORDER BY timestamp DESC;
    `;
    const formattedRows = rows.map(row => ({
        ...row,
        timestamp: row.timestamp ? formatISO(new Date(row.timestamp)) : null, // Should always be a date
    }));
    return NextResponse.json(formattedRows);
  } catch (error) {
    console.error('Failed to fetch transactions from Postgres:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  let transactionData: Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string };
  try {
      transactionData = await request.json();
  } catch(e) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const id = nanoid();
  const timestamp = transactionData.timestamp ? new Date(transactionData.timestamp) : new Date();

  const newTransaction: Transaction = {
      id: `dev-${id}`, // Prefix for dev mode
      productId: transactionData.productId,
      productName: transactionData.productName || null,
      batchId: transactionData.batchId || null,
      type: transactionData.type,
      quantity: transactionData.quantity,
      timestamp: timestamp.toISOString(),
      reason: transactionData.reason || null,
      notes: transactionData.notes || null,
      unitCostAtTransaction: transactionData.unitCostAtTransaction !== undefined ? transactionData.unitCostAtTransaction : null,
      isCorrectionIncrease: transactionData.isCorrectionIncrease || false,
  };
  newTransaction.id = id; // Correct ID for DB

  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for POST /api/transactions. Simulating transaction creation.");
    newTransaction.id = `dev-${id}`; // Ensure dev prefix for dev mode object
    return NextResponse.json(newTransaction, { status: 201 });
  }


  try {
    if (!transactionData.productId || !transactionData.type || transactionData.quantity === undefined) {
      return NextResponse.json({ error: 'Missing required transaction fields' }, { status: 400 });
    }

    if (isNaN(timestamp.getTime())) {
        return NextResponse.json({ error: 'Invalid timestamp format provided' }, { status: 400 });
    }

    await sql`
      INSERT INTO transactions (
        id, product_id, product_name, batch_id, type, quantity, 
        timestamp, reason, notes, unit_cost_at_transaction, is_correction_increase
      )
      VALUES (
        ${newTransaction.id}, 
        ${newTransaction.productId}, 
        ${newTransaction.productName}, 
        ${newTransaction.batchId}, 
        ${newTransaction.type}, 
        ${newTransaction.quantity}, 
        ${newTransaction.timestamp}, 
        ${newTransaction.reason}, 
        ${newTransaction.notes},
        ${newTransaction.unitCostAtTransaction},
        ${newTransaction.isCorrectionIncrease}
      );
    `;
    
    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error('Failed to create transaction in Postgres:', error);
    return NextResponse.json({ error: 'Failed to create transaction', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

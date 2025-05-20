
'use server';
import { NextResponse } from 'next/server';
import type { Transaction } from '@/lib/types';
import { sql } from '@vercel/postgres';
import { nanoid } from 'nanoid';
import { formatISO } from 'date-fns';

export async function GET() {
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
    // Ensure timestamp is ISO string
    const formattedRows = rows.map(row => ({
        ...row,
        timestamp: row.timestamp ? formatISO(new Date(row.timestamp)) : null,
    }));
    return NextResponse.json(formattedRows);
  } catch (error) {
    console.error('Failed to fetch transactions from Postgres:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const transactionData = await request.json() as Omit<Transaction, 'id' | 'timestamp'> & { timestamp?: string };
    
    if (!transactionData.productId || !transactionData.type || transactionData.quantity === undefined) {
      return NextResponse.json({ error: 'Missing required transaction fields' }, { status: 400 });
    }

    const id = nanoid();
    // Use provided timestamp if available and valid, otherwise use current time
    const timestamp = transactionData.timestamp ? new Date(transactionData.timestamp) : new Date();
    if (isNaN(timestamp.getTime())) {
        return NextResponse.json({ error: 'Invalid timestamp format provided' }, { status: 400 });
    }


    const newTransaction: Transaction = {
      id,
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
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

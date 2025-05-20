
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { AppSettings } from '@/lib/types';

// CREATE TABLE app_settings (
//     id INTEGER PRIMARY KEY DEFAULT 1,
//     expiry_warning_days INTEGER NOT NULL DEFAULT 7,
//     CONSTRAINT single_row_check CHECK (id = 1)
// );
// INSERT INTO app_settings (id, expiry_warning_days) VALUES (1, 7) ON CONFLICT (id) DO NOTHING;

const DEFAULT_DEV_SETTINGS: AppSettings = { expiryWarningDays: 7 };

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
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for GET /api/settings. Returning default settings.");
    return NextResponse.json(DEFAULT_DEV_SETTINGS);
  }

  try {
    const { rows } = await sql`
      SELECT expiry_warning_days AS "expiryWarningDays"
      FROM app_settings 
      WHERE id = 1; 
    `;
    if (rows.length === 0) {
      // If no settings row exists, attempt to insert default and return it
      // This could happen if the INSERT ON CONFLICT didn't run or if table was cleared
      console.log("No settings found in DB, attempting to insert default app_settings.");
      await sql`
        INSERT INTO app_settings (id, expiry_warning_days) 
        VALUES (1, ${DEFAULT_DEV_SETTINGS.expiryWarningDays}) 
        ON CONFLICT (id) DO NOTHING;
      `;
      // Re-fetch or return default
      const freshFetch = await sql`SELECT expiry_warning_days AS "expiryWarningDays" FROM app_settings WHERE id = 1;`;
      if (freshFetch.rows.length > 0) {
        return NextResponse.json(freshFetch.rows[0]);
      }
      return NextResponse.json(DEFAULT_DEV_SETTINGS); // Fallback if insert somehow failed silently
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch app settings from Postgres:', error);
    // Fallback to default settings on error to prevent UI breakage
    return NextResponse.json(DEFAULT_DEV_SETTINGS, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Partial<AppSettings>;
  try {
    payload = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON payload for PUT settings' }, { status: 400 });
  }
  const { expiryWarningDays } = payload;

  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for PUT /api/settings. Simulating update.");
    if (expiryWarningDays !== undefined) {
        DEFAULT_DEV_SETTINGS.expiryWarningDays = expiryWarningDays; // "Update" in-memory dev default
    }
    return NextResponse.json(DEFAULT_DEV_SETTINGS);
  }


  try {
    if (expiryWarningDays === undefined || typeof expiryWarningDays !== 'number' || expiryWarningDays < 0) {
      return NextResponse.json({ error: 'Valid expiryWarningDays (non-negative number) is required.' }, { status: 400 });
    }

    // Ensure the settings row exists, then update.
    // Using ON CONFLICT DO UPDATE ensures the row is created if it doesn't exist, or updated if it does.
    const result = await sql`
      INSERT INTO app_settings (id, expiry_warning_days)
      VALUES (1, ${expiryWarningDays})
      ON CONFLICT (id) DO UPDATE 
      SET expiry_warning_days = EXCLUDED.expiry_warning_days
      RETURNING expiry_warning_days AS "expiryWarningDays";
    `;
    
    if (result.rows.length > 0) {
        return NextResponse.json(result.rows[0]);
    }
    // This case should ideally not be reached if ON CONFLICT DO UPDATE works as expected
    return NextResponse.json({ error: 'Failed to update or insert settings' }, { status: 500 });

  } catch (error) {
    console.error('Failed to update app settings in Postgres:', error);
    return NextResponse.json({ error: 'Failed to update app settings', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

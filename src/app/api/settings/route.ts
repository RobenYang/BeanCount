
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { AppSettings } from '@/lib/types';

// Ensure this matches your table schema in Neon SQL Editor
// CREATE TABLE app_settings (
//     id INTEGER PRIMARY KEY DEFAULT 1,
//     expiry_warning_days INTEGER NOT NULL DEFAULT 7,
//     depletion_warning_days INTEGER NOT NULL DEFAULT 5, // Ensure this column exists
//     CONSTRAINT single_row_check CHECK (id = 1)
// );
// INSERT INTO app_settings (id, expiry_warning_days, depletion_warning_days) VALUES (1, 7, 5) ON CONFLICT (id) DO NOTHING;

const DEFAULT_DEV_SETTINGS: AppSettings = { expiryWarningDays: 7, depletionWarningDays: 5 };

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
      SELECT 
        expiry_warning_days AS "expiryWarningDays",
        depletion_warning_days AS "depletionWarningDays"
      FROM app_settings 
      WHERE id = 1; 
    `;
    if (rows.length === 0) {
      console.log("No settings found in DB, attempting to insert default app_settings.");
      await sql`
        INSERT INTO app_settings (id, expiry_warning_days, depletion_warning_days) 
        VALUES (1, ${DEFAULT_DEV_SETTINGS.expiryWarningDays}, ${DEFAULT_DEV_SETTINGS.depletionWarningDays}) 
        ON CONFLICT (id) DO NOTHING;
      `;
      const freshFetch = await sql`
        SELECT 
            expiry_warning_days AS "expiryWarningDays",
            depletion_warning_days AS "depletionWarningDays"
        FROM app_settings WHERE id = 1;`;
      if (freshFetch.rows.length > 0) {
        return NextResponse.json(freshFetch.rows[0]);
      }
      // If insertion failed or still no row, return defaults
      return NextResponse.json(DEFAULT_DEV_SETTINGS);
    }
    // Ensure both fields are present, even if one was null in DB (e.g. due to older schema)
    const settingsFromDb = rows[0];
    const completeSettings: AppSettings = {
        expiryWarningDays: settingsFromDb.expiryWarningDays ?? DEFAULT_DEV_SETTINGS.expiryWarningDays,
        depletionWarningDays: settingsFromDb.depletionWarningDays ?? DEFAULT_DEV_SETTINGS.depletionWarningDays,
    };
    return NextResponse.json(completeSettings);
  } catch (error) {
    console.error('Failed to fetch app settings from Postgres:', error);
    // Return defaults on error to allow app to function
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
  const { expiryWarningDays, depletionWarningDays } = payload;

  if (!process.env.POSTGRES_URL) {
    console.warn("POSTGRES_URL is not set. Running in DB-less local development mode for PUT /api/settings. Simulating update.");
    if (expiryWarningDays !== undefined) DEFAULT_DEV_SETTINGS.expiryWarningDays = expiryWarningDays;
    if (depletionWarningDays !== undefined) DEFAULT_DEV_SETTINGS.depletionWarningDays = depletionWarningDays;
    return NextResponse.json(DEFAULT_DEV_SETTINGS);
  }

  try {
    // Validate that both required fields are present and are numbers
    if (expiryWarningDays === undefined || typeof expiryWarningDays !== 'number' || expiryWarningDays < 0) {
      return NextResponse.json({ error: '有效的临近过期预警天数 (非负数) 为必填项。' }, { status: 400 });
    }
    if (depletionWarningDays === undefined || typeof depletionWarningDays !== 'number' || depletionWarningDays < 0) {
      return NextResponse.json({ error: '有效的预计耗尽预警天数 (非负数) 为必填项。' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO app_settings (id, expiry_warning_days, depletion_warning_days)
      VALUES (1, ${expiryWarningDays}, ${depletionWarningDays})
      ON CONFLICT (id) DO UPDATE 
      SET 
        expiry_warning_days = EXCLUDED.expiry_warning_days,
        depletion_warning_days = EXCLUDED.depletion_warning_days
      RETURNING expiry_warning_days AS "expiryWarningDays", depletion_warning_days AS "depletionWarningDays";
    `;
    
    if (result.rows.length > 0) {
        return NextResponse.json(result.rows[0]);
    }
    // This case should ideally not be reached if ON CONFLICT DO UPDATE RETURNING works as expected.
    // If it does, it means the insert/update failed silently or didn't return rows.
    return NextResponse.json({ error: 'Failed to update or insert settings' }, { status: 500 });

  } catch (error) {
    console.error('Failed to update app settings in Postgres:', error);
    return NextResponse.json({ error: '更新应用设置失败', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

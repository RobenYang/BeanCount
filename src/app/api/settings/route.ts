
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { AppSettings } from '@/lib/types';

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
    // Ensure the settings row exists with all necessary columns and default values
    // ON CONFLICT DO UPDATE is crucial here if the row exists but might be missing a new column's value
    await sql`
      INSERT INTO app_settings (id, expiry_warning_days, depletion_warning_days) 
      VALUES (1, ${DEFAULT_DEV_SETTINGS.expiryWarningDays}, ${DEFAULT_DEV_SETTINGS.depletionWarningDays}) 
      ON CONFLICT (id) DO UPDATE SET
        expiry_warning_days = EXCLUDED.expiry_warning_days,
        depletion_warning_days = EXCLUDED.depletion_warning_days;
    `;
    
    // Fetch the (potentially just created or updated) settings
    const { rows } = await sql`
      SELECT 
        expiry_warning_days AS "expiryWarningDays",
        depletion_warning_days AS "depletionWarningDays"
      FROM app_settings 
      WHERE id = 1; 
    `;

    if (rows.length > 0) {
      const settingsFromDb = rows[0];
      // Ensure both fields are present, falling back to defaults if somehow still null after the INSERT/UPDATE
      const completeSettings: AppSettings = {
          expiryWarningDays: settingsFromDb.expiryWarningDays ?? DEFAULT_DEV_SETTINGS.expiryWarningDays,
          depletionWarningDays: settingsFromDb.depletionWarningDays ?? DEFAULT_DEV_SETTINGS.depletionWarningDays,
      };
      return NextResponse.json(completeSettings);
    } else {
      // This case should be extremely rare given the INSERT...ON CONFLICT logic above
      console.error("CRITICAL: Failed to read default settings after attempting to ensure row id=1 exists in app_settings. Returning app defaults.");
      return NextResponse.json(DEFAULT_DEV_SETTINGS);
    }
  } catch (error) {
    console.error('Failed to fetch/ensure app settings from Postgres:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to fetch or initialize app settings from database.', details: errorMessage }, { status: 500 });
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
    const newDevSettings = { ...DEFAULT_DEV_SETTINGS };
    if (expiryWarningDays !== undefined) newDevSettings.expiryWarningDays = expiryWarningDays;
    if (depletionWarningDays !== undefined) newDevSettings.depletionWarningDays = depletionWarningDays;
    return NextResponse.json(newDevSettings);
  }

  try {
    if (expiryWarningDays === undefined || typeof expiryWarningDays !== 'number' || expiryWarningDays < 0) {
      return NextResponse.json({ error: '有效的临近过期预警天数 (非负数) 为必填项。' }, { status: 400 });
    }
    if (depletionWarningDays === undefined || typeof depletionWarningDays !== 'number' || depletionWarningDays < 0) {
      return NextResponse.json({ error: '有效的预计耗尽预警天数 (非负数) 为必填项。' }, { status: 400 });
    }

    const result = await sql`
      UPDATE app_settings 
      SET 
        expiry_warning_days = ${expiryWarningDays},
        depletion_warning_days = ${depletionWarningDays}
      WHERE id = 1
      RETURNING expiry_warning_days AS "expiryWarningDays", depletion_warning_days AS "depletionWarningDays";
    `;
    
    if (result.rows.length > 0) {
        return NextResponse.json(result.rows[0]);
    } else {
        // This would happen if the row id=1 didn't exist, which the GET request tries to prevent.
        // But as a fallback for PUT, we could try to insert if update affected 0 rows.
        const insertResult = await sql`
            INSERT INTO app_settings (id, expiry_warning_days, depletion_warning_days)
            VALUES (1, ${expiryWarningDays}, ${depletionWarningDays})
            ON CONFLICT (id) DO UPDATE 
            SET 
                expiry_warning_days = EXCLUDED.expiry_warning_days,
                depletion_warning_days = EXCLUDED.depletion_warning_days
            RETURNING expiry_warning_days AS "expiryWarningDays", depletion_warning_days AS "depletionWarningDays";
        `;
        if (insertResult.rows.length > 0) {
            return NextResponse.json(insertResult.rows[0]);
        }
        return NextResponse.json({ error: 'Failed to update or insert settings' }, { status: 500 });
    }

  } catch (error) {
    console.error('Failed to update app settings in Postgres:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: '更新应用设置失败', details: errorMessage }, { status: 500 });
  }
}


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

export async function GET(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { rows } = await sql`
      SELECT expiry_warning_days AS "expiryWarningDays"
      FROM app_settings 
      WHERE id = 1; 
    `;
    if (rows.length === 0) {
      const defaultSettings: AppSettings = { expiryWarningDays: 7 };
      await sql`
        INSERT INTO app_settings (id, expiry_warning_days) 
        VALUES (1, ${defaultSettings.expiryWarningDays}) 
        ON CONFLICT (id) DO NOTHING;
      `;
      return NextResponse.json(defaultSettings);
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch app settings from Postgres:', error);
    const defaultSettingsOnError: AppSettings = { expiryWarningDays: 7 };
    return NextResponse.json(defaultSettingsOnError, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!authenticateRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { expiryWarningDays } = await request.json() as Partial<AppSettings>;

    if (expiryWarningDays === undefined || typeof expiryWarningDays !== 'number' || expiryWarningDays < 0) {
      return NextResponse.json({ error: 'Valid expiryWarningDays (non-negative number) is required.' }, { status: 400 });
    }

    const result = await sql`
      UPDATE app_settings
      SET expiry_warning_days = ${expiryWarningDays}
      WHERE id = 1
      RETURNING expiry_warning_days AS "expiryWarningDays";
    `;

    if (result.rowCount === 0) {
      await sql`
        INSERT INTO app_settings (id, expiry_warning_days)
        VALUES (1, ${expiryWarningDays})
        ON CONFLICT (id) DO 
        UPDATE SET expiry_warning_days = EXCLUDED.expiry_warning_days;
      `;
       const { rows } = await sql`SELECT expiry_warning_days AS "expiryWarningDays" FROM app_settings WHERE id = 1;`;
       if (rows.length > 0) {
        return NextResponse.json(rows[0]);
       }
       return NextResponse.json({ error: 'Failed to update or insert settings' }, { status: 500 });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to update app settings in Postgres:', error);
    return NextResponse.json({ error: 'Failed to update app settings' }, { status: 500 });
  }
}

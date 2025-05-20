
'use server';
import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import type { AppSettings } from '@/lib/types';

// GET /api/settings - Fetches current app settings
export async function GET() {
  try {
    const { rows } = await sql`
      SELECT expiry_warning_days AS "expiryWarningDays"
      FROM app_settings 
      WHERE id = 1; 
    `;
    if (rows.length === 0) {
      // This case should ideally not happen if default row is inserted.
      // Fallback to default if table is empty or row is missing.
      const defaultSettings: AppSettings = { expiryWarningDays: 7 };
      // Optionally, insert default settings if not found
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
    // Return default settings on error to ensure app functions
    const defaultSettingsOnError: AppSettings = { expiryWarningDays: 7 };
    return NextResponse.json(defaultSettingsOnError, { status: 500 }); // Indicate error but provide defaults
  }
}

// PUT /api/settings - Updates app settings
export async function PUT(request: Request) {
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
      // If no row was updated (e.g., id=1 didn't exist), try to insert it.
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
    
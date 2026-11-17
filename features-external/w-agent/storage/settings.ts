import { query } from './db.js';

/**
 * Read a settings value by key (JSON). Returns null when missing.
 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const result = await query<{ value: T }>(`SELECT value FROM settings WHERE key = $1`, [key]);
  return result.rows[0]?.value ?? null;
}

/**
 * Upsert a settings value by key.
 */
export async function setSetting(key: string, value: unknown): Promise<void> {
  await query(
    `
      INSERT INTO settings (key, value)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
    [key, JSON.stringify(value)],
  );
}

/**
 * Merge a partial object into an existing JSON settings object.
 */
export async function mergeSetting<T extends Record<string, unknown>>(
  key: string,
  patch: Partial<T>,
): Promise<T> {
  const current = ((await getSetting<T>(key)) ?? {}) as T;
  const next = { ...current, ...patch };
  await setSetting(key, next);
  return next;
}

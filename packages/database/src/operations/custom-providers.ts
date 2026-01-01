import { getDatabase } from '../db.js';
import {
  type CustomProviderDb,
  type CustomProviderInput,
  CustomProviderInputSchema,
} from '../types.js';

/**
 * Add a custom provider (user-defined scraping source)
 */
export function addCustomProvider(provider: CustomProviderInput): number {
  const db = getDatabase();
  const validated = CustomProviderInputSchema.parse(provider);

  const query = db.prepare(`
    INSERT INTO custom_providers (
      name, base_url, scraper_type, selector_config, created_at, is_active
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `);

  const result = query.run(
    validated.name,
    validated.base_url,
    validated.scraper_type ?? 'generic',
    validated.selector_config ?? null,
    validated.created_at,
    validated.is_active ?? 1,
  );

  console.log(`✅ Added custom provider: ${validated.name}`);
  return Number(result.lastInsertRowid);
}

/**
 * Get custom provider by name
 */
export function getCustomProvider(name: string): CustomProviderDb | null {
  const db = getDatabase();

  const query = db.prepare<CustomProviderDb, [string]>(`
    SELECT * FROM custom_providers WHERE name = ?1
  `);

  return query.get(name) || null;
}

/**
 * Get all active custom providers
 */
export function getActiveCustomProviders(): CustomProviderDb[] {
  const db = getDatabase();

  const query = db.prepare<CustomProviderDb, []>(`
    SELECT * FROM custom_providers WHERE is_active = 1
  `);

  return query.all();
}

/**
 * Update custom provider configuration
 */
export function updateCustomProvider(
  name: string,
  updates: Partial<Omit<CustomProviderInput, 'name' | 'created_at'>>,
): void {
  const db = getDatabase();

  const sets: string[] = [];
  const values: any[] = [];

  if (updates.base_url !== undefined) {
    sets.push('base_url = ?');
    values.push(updates.base_url);
  }
  if (updates.scraper_type !== undefined) {
    sets.push('scraper_type = ?');
    values.push(updates.scraper_type);
  }
  if (updates.selector_config !== undefined) {
    sets.push('selector_config = ?');
    values.push(updates.selector_config);
  }
  if (updates.is_active !== undefined) {
    sets.push('is_active = ?');
    values.push(updates.is_active);
  }

  if (sets.length === 0) return;

  values.push(name);

  const query = db.prepare(`
    UPDATE custom_providers SET ${sets.join(', ')} WHERE name = ?${sets.length + 1}
  `);

  query.run(...values);
}

/**
 * Delete custom provider
 */
export function deleteCustomProvider(name: string): void {
  const db = getDatabase();

  const query = db.prepare(`DELETE FROM custom_providers WHERE name = ?1`);
  query.run(name);

  console.log(`🗑️  Deleted custom provider: ${name}`);
}

import { getDatabase } from '../db.js';
import {
  type ProviderDomainDb,
  type ProviderDomainInput,
  ProviderDomainInputSchema,
} from '../types.js';

/**
 * Get current domain for a provider
 */
export function getProviderDomain(provider: string): ProviderDomainDb | null {
  const db = getDatabase();

  const query = db.prepare<ProviderDomainDb, [string]>(`
    SELECT * FROM provider_domains WHERE provider = ?1
  `);

  return query.get(provider) || null;
}

/**
 * Register or update a provider's domain
 */
export function setProviderDomain(domain: ProviderDomainInput): void {
  const db = getDatabase();
  const validated = ProviderDomainInputSchema.parse(domain);

  const query = db.prepare(`
    INSERT INTO provider_domains (
      provider, current_domain, previous_domains, last_updated, is_active, notes
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT(provider) DO UPDATE SET
      current_domain = excluded.current_domain,
      previous_domains = excluded.previous_domains,
      last_updated = excluded.last_updated,
      is_active = excluded.is_active,
      notes = excluded.notes
  `);

  query.run(
    validated.provider,
    validated.current_domain,
    validated.previous_domains ?? null,
    validated.last_updated,
    validated.is_active ?? 1,
    validated.notes ?? null,
  );
}

/**
 * Update provider domain (for migrations)
 * Preserves history of previous domains
 */
export function migrateProviderDomain(provider: string, newDomain: string, reason?: string): void {
  const db = getDatabase();
  const existing = getProviderDomain(provider);

  if (!existing) {
    // New provider
    setProviderDomain({
      provider,
      current_domain: newDomain,
      last_updated: Date.now(),
      notes: reason,
    });
    return;
  }

  // Add old domain to history
  const previousDomains = existing.previous_domains ? JSON.parse(existing.previous_domains) : [];

  previousDomains.push({
    domain: existing.current_domain,
    date: existing.last_updated,
  });

  setProviderDomain({
    provider,
    current_domain: newDomain,
    previous_domains: JSON.stringify(previousDomains),
    last_updated: Date.now(),
    is_active: 1,
    notes: reason,
  });

  console.log(`✅ Migrated ${provider} from ${existing.current_domain} to ${newDomain}`);
}

/**
 * Mark provider as inactive (dead site)
 */
export function deactivateProviderDomain(provider: string, reason?: string): void {
  const db = getDatabase();

  const query = db.prepare(`
    UPDATE provider_domains 
    SET is_active = 0, notes = COALESCE(?2, notes), last_updated = ?3
    WHERE provider = ?1
  `);

  query.run(provider, reason, Date.now());
  console.log(`🔴 Deactivated provider: ${provider}`);
}

/**
 * Get all active providers
 */
export function getActiveProviders(): ProviderDomainDb[] {
  const db = getDatabase();

  const query = db.prepare<ProviderDomainDb, []>(`
    SELECT * FROM provider_domains WHERE is_active = 1
  `);

  return query.all();
}

/**
 * Get provider domain history
 */
export function getProviderHistory(provider: string): Array<{ domain: string; date: number }> {
  const existing = getProviderDomain(provider);

  if (!existing || !existing.previous_domains) {
    return [];
  }

  return JSON.parse(existing.previous_domains);
}

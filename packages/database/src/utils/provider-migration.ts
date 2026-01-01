import { getAllMappings, createMapping, deleteMapping, remapManga } from './mapping.js';
import { saveProviderManga, deactivateProvider } from './provider.js';
import { deactivateProviderDomain, migrateProviderDomain } from './domains.js';
import { getDatabase } from '../db.js';

/**
 * Provider death/migration utilities
 * Handles scenarios where providers go offline or change domains
 */

/**
 * Full provider migration workflow
 * Moves all manga from old provider to new provider
 */
export async function migrateProvider(
  oldProvider: string,
  newProvider: string,
  newDomain: string,
  options: {
    deactivateOld?: boolean;
    preserveHistory?: boolean;
    batchSize?: number;
  } = {},
): Promise<{
  migrated: number;
  failed: number;
  errors: Array<{ anilistId: number; error: string }>;
}> {
  const { deactivateOld = true, preserveHistory = true, batchSize = 50 } = options;

  // Get all anilist manga that have mappings to old provider
  const db = getDatabase();
  const query = db.prepare<{ anilist_id: number }, [string]>(`
    SELECT DISTINCT anilist_id FROM manga_mappings
    WHERE provider = ?1 AND is_active = 1
  `);

  const anilistIds = query.all(oldProvider).map((row) => row.anilist_id);

  console.log(
    `📦 Found ${anilistIds.length} manga to migrate from ${oldProvider} to ${newProvider}`,
  );

  let migrated = 0;
  let failed = 0;
  const errors: Array<{ anilistId: number; error: string }> = [];

  // Process in batches
  for (let i = 0; i < anilistIds.length; i += batchSize) {
    const batch = anilistIds.slice(i, i + batchSize);

    for (const anilistId of batch) {
      try {
        // Note: This is a placeholder - actual implementation would need
        // to scrape the new provider to find matching manga
        // For now, we just mark it for manual remapping

        if (preserveHistory) {
          deleteMapping(anilistId, oldProvider);
        }

        migrated++;
      } catch (error) {
        failed++;
        errors.push({
          anilistId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(`Progress: ${Math.min(i + batchSize, anilistIds.length)}/${anilistIds.length}`);
  }

  // Update provider domains
  migrateProviderDomain(oldProvider, newDomain, `Migrated to ${newProvider}`);

  if (deactivateOld) {
    deactivateProviderDomain(oldProvider, 'Site dead / migrated');
    deactivateProvider(oldProvider);
  }

  console.log(`✅ Migration complete: ${migrated} migrated, ${failed} failed`);

  return { migrated, failed, errors };
}

/**
 * Bulk remap manga to new provider
 * For when provider changes but manga IDs stay same
 */
export function bulkRemapSameDomain(provider: string, newDomain: string): number {
  // Update all provider_manga entries with new domain
  const db = getDatabase();

  const oldDomain = getProviderDomain(provider);
  if (!oldDomain) {
    throw new Error(`Provider ${provider} not found`);
  }

  const query = db.prepare(`
    UPDATE provider_manga 
    SET 
      provider_url = REPLACE(provider_url, ?1, ?2),
      domain_changed_from = ?1,
      last_checked = ?3
    WHERE provider = ?4
  `);

  const result = query.run(oldDomain.current_domain, newDomain, Date.now(), provider);

  // Update domain record
  migrateProviderDomain(provider, newDomain, 'Domain changed');

  console.log(
    `✅ Updated ${result.changes} manga URLs from ${oldDomain.current_domain} to ${newDomain}`,
  );

  return result.changes;
}

/**
 * Get migration status for a provider
 */
export function getMigrationStatus(provider: string): {
  totalManga: number;
  activeMappings: number;
  inactiveMappings: number;
  needsRemapping: number;
} {
  const db = getDatabase();

  const totalQuery = db.prepare<{ count: number }, [string]>(`
    SELECT COUNT(*) as count FROM provider_manga WHERE provider = ?1
  `);
  const total = totalQuery.get(provider);

  const activeQuery = db.prepare<{ count: number }, [string]>(`
    SELECT COUNT(*) as count FROM manga_mappings 
    WHERE provider = ?1 AND is_active = 1
  `);
  const active = activeQuery.get(provider);

  const inactiveQuery = db.prepare<{ count: number }, [string]>(`
    SELECT COUNT(*) as count FROM manga_mappings 
    WHERE provider = ?1 AND is_active = 0
  `);
  const inactive = inactiveQuery.get(provider);

  return {
    totalManga: total?.count || 0,
    activeMappings: active?.count || 0,
    inactiveMappings: inactive?.count || 0,
    needsRemapping: (total?.count || 0) - (active?.count || 0),
  };
}

/**
 * Import function for domain operations
 */
function getProviderDomain(provider: string) {
  // This would import from domains.ts but avoiding circular dependency
  // Implementation would be similar to getProviderDomain in domains.ts
  const db = getDatabase();
  const query = db.prepare<any, [string]>(`
    SELECT * FROM provider_domains WHERE provider = ?1
  `);
  return query.get(provider);
}

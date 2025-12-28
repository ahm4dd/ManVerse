import { defu } from 'defu';
import AsuraScansScarper from './asura.ts';
import { Providers, ProviderType } from '../config/constants.ts';
import { AsuraScansConfigSchema } from '../config/types.ts';
import Scraper from './scraper.ts';
import { asuraScansConfig } from '../config/asura.config.ts';

const ScraperRegistry = {
  [Providers.AsuraScans]: {
    schema: AsuraScansConfigSchema,
    class: AsuraScansScarper,
    defaultConfig: asuraScansConfig,
  },
} as const;

export default class ScraperFactory {
  static createScraper(provider: ProviderType, config?: unknown): Scraper {
    const entry = ScraperRegistry[provider];

    if (!entry) {
      throw new Error(`Scraper provider '${provider}' is not registered.`);
    }

    // Merge user config with defaults (defu handles undefined gracefully)
    const mergedConfig = defu(config as Record<string, unknown>, entry.defaultConfig);

    // Set provider name
    if (typeof mergedConfig === 'object' && mergedConfig !== null) {
      mergedConfig.name = provider;
    }

    // Validate configuration
    const parseResult = entry.schema.safeParse(mergedConfig);

    if (!parseResult.success) {
      throw new Error(`Invalid configuration for ${provider}`);
    }

    return new entry.class(parseResult.data);
  }
}

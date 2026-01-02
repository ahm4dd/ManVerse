import { defu } from 'defu';
import AsuraScansScraper from './asura.ts';
import { Providers, ProviderType } from '@manverse/core';
import { AsuraScansConfigSchema } from '../config/types.ts';
import type IScraper from './scraper.ts';
import { asuraScansConfig } from '../config/asura.config.ts';

const ScraperRegistry = {
  [Providers.AsuraScans]: {
    schema: AsuraScansConfigSchema,
    class: AsuraScansScraper,
    defaultConfig: asuraScansConfig,
  },
} as const;

export default class ScraperFactory {
  static createScraper(provider: ProviderType, config?: unknown): IScraper {
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

import { defu } from 'defu';
import AsuraScansScraper from './asura.ts';
import ToonilyScraper from './toonily.ts';
import MangaGGScraper from './mangagg.ts';
import MangaFireScraper from './mangafire.ts';
import { Providers, ProviderType } from '@manverse/core';
import {
  AsuraScansConfigSchema,
  MangaGGConfigSchema,
  MangaFireConfigSchema,
  ToonilyConfigSchema,
} from '../config/types.ts';
import type IScraper from './scraper.ts';
import { asuraScansConfig } from '../config/asura.config.ts';
import { toonilyConfig } from '../config/toonily.config.ts';
import { mangaggConfig } from '../config/mangagg.config.ts';
import { mangafireConfig } from '../config/mangafire.config.ts';

const ScraperRegistry = {
  [Providers.AsuraScans]: {
    schema: AsuraScansConfigSchema,
    class: AsuraScansScraper,
    defaultConfig: asuraScansConfig,
  },
  [Providers.Toonily]: {
    schema: ToonilyConfigSchema,
    class: ToonilyScraper,
    defaultConfig: toonilyConfig,
  },
  [Providers.MangaGG]: {
    schema: MangaGGConfigSchema,
    class: MangaGGScraper,
    defaultConfig: mangaggConfig,
  },
  [Providers.MangaFire]: {
    schema: MangaFireConfigSchema,
    class: MangaFireScraper,
    defaultConfig: mangafireConfig,
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

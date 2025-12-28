# Configuration System

This directory contains all configuration files for the ManVerse scraper project.

## Usage

### Using Default Configurations

```typescript
import { defaultBrowserConfig, asuraScansConfig } from './config/index.js';
import { AsuraScans } from './services/scraper/asuraScans.js';

// Browser config is used in main/index
const browser = await puppeteer.launch({
  headless: defaultBrowserConfig.headless,
  args: defaultBrowserConfig.args,
});

// Scraper uses its config by default
const scraper = new AsuraScans(); // Uses asuraScansConfig
```

### Creating Custom Configurations

#### Custom Browser Configuration

```typescript
import { BrowserConfig } from './config/types.js';

const customBrowserConfig: BrowserConfig = {
  headless: false, // Run with visible browser
  args: ['--no-sandbox'],
  viewport: {
    width: 1280,
    height: 720,
  },
  timeout: 30000,
};
```

#### Custom Scraper Configuration

```typescript
import { asuraScansConfig, AsuraScansConfig } from './config/index.js';

const customAsuraConfig: AsuraScansConfig = {
  ...asuraScansConfig,
  timeout: 120000, // Increase timeout
  retries: 5,      // More retries
  selectors: {
    ...asuraScansConfig.selectors,
    detail: {
      ...asuraScansConfig.selectors.detail,
      title: 'h1.custom-title', // Override specific selector
    },
  },
};

const scraper = new AsuraScans(customAsuraConfig);
```

## Configuration Files

### `types.ts`

Defines TypeScript types and Zod validation schemas for:
- **BrowserConfig**: Puppeteer browser settings
- **ScraperConfig**: Base scraper configuration
- **AsuraScansConfig**: AsuraScans-specific settings with CSS selectors

### `browser.config.ts`

Default Puppeteer browser configuration including:
- Headless mode settings
- Browser arguments for performance and compatibility
- Viewport dimensions
- Default timeout
- User agent string

### `asuraScans.config.ts`

AsuraScans scraper configuration including:
- Base URL
- Request headers (Referer, User-Agent)
- Timeout and retry settings
- **CSS Selectors** for search and detail pages:
  - Search: result containers, navigation buttons
  - Detail: title, image, status, rating, genres, chapters, etc.

## Extending for New Scrapers

To add a new scraper:

1. **Create a new config schema** in `types.ts`:
```typescript
export const NewScraperConfigSchema = ScraperConfigSchema.extend({
  // Add scraper-specific fields
  selectors: z.object({
    // Define selectors
  }),
});

export type NewScraperConfig = z.infer<typeof NewScraperConfigSchema>;
```

2. **Create a config file** `newScraper.config.ts`:
```typescript
import { NewScraperConfig } from './types.js';

export const newScraperConfig: NewScraperConfig = {
  name: 'NewScraper',
  baseUrl: 'https://example.com/',
  // ... other settings
};
```

3. **Export in `index.ts`**:
```typescript
export * from './newScraper.config.js';
```

4. **Use in scraper class**:
```typescript
export class NewScraper extends Scraper {
  private config: NewScraperConfig;

  constructor(config: NewScraperConfig = newScraperConfig) {
    super();
    this.config = config;
  }
}
```

## Benefits

**Type Safety**: Zod schemas provide runtime validation  
 **Flexibility**: Easy to override defaults for testing or different environments  
**Maintainability**: All settings in one place, not scattered through code  
**Extensibility**: Simple pattern for adding new scrapers  
**Documentation**: Config files serve as documentation for available settings

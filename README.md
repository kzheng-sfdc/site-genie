# Site Genie

A web scraper and analyzer that captures full HTML (after JavaScript execution), full-page screenshots, and uses AI to deconstruct and analyze websites.

## Features

### Scraping
- 📄 Captures complete HTML after JavaScript execution
- 📸 Takes full-page screenshots
- 🎯 Uses Playwright for reliable browser automation
- 💾 Organized output structure by domain
- 🥷 Advanced bot detection evasion:
  - Realistic user agents (randomized)
  - Complete browser headers (Accept, Accept-Language, etc.)
  - Locale and timezone settings
  - Removes automation signatures (navigator.webdriver)
  - Mocks browser plugins and permissions
  - Human-like behavior (random scrolling, timing)
  - Proper Referer headers
- ⚡ Resilient timeout handling:
  - Tries networkidle first (best for complete content)
  - Falls back to domcontentloaded if needed
  - Works with sites that have persistent connections
- 🚫 Auto-dismisses popups and overlays:
  - Cookie consent dialogs
  - Promotional modals
  - Email signup popups
  - Newsletter overlays
  - Close buttons and X icons
  - ESC key press for modal dismissal
- 🖼️ Complete image loading:
  - Scrolls through entire page to trigger lazy-loaded images
  - Waits for all visible images to fully load
  - Verifies images have loaded (not just placeholders)
  - 15-second timeout per image check to prevent hanging

### AI Analysis
- 🤖 Uses Claude to analyze scraped websites
- 📊 Extracts structure, design patterns, and content
- 🔍 Identifies components, frameworks, and technical details
- 💡 Provides recommendations and insights
- ✂️ Automatically breaks down screenshots into sections:
  - Extracts header, hero, content sections, footer
  - Saves each section as a separate image
  - Creates section-by-section analysis
  - Stores all sections in `output/{domain}/analysis/` folder
  - Uses Handlebars templates for dynamic domain paths

## Requirements

- Node.js 18+
- pnpm
- [Claude CLI](https://docs.anthropic.com/en/docs/build-with-claude/claude-cli) (for deconstruction feature)

## Installation

```bash
pnpm install
pnpm exec playwright install chromium
```

## Usage

### 1. Scrape a Website

```bash
pnpm scraper <url>
```

Example:
```bash
pnpm scraper https://www.spacenk.com
```

This will:
- Scrape the website with full JavaScript execution
- Dismiss modals and popups
- Load all images
- Save HTML and screenshots to `output/www-spacenk-com/`

### 2. Deconstruct with AI

```bash
pnpm deconstructor <domain-folder>
```

Example:
```bash
pnpm deconstructor www-spacenk-com
```

This will:
- Find the latest HTML and screenshot from the domain folder
- Use Claude AI to analyze the website
- Break down the screenshot into individual section images
- Save section images to `output/www-spacenk-com/analysis/`
- Provide insights on structure, design, components, and more

To see available folders:
```bash
pnpm deconstructor
```

### Programmatic Usage

```typescript
import { scrapeUrl, scrapeUrls } from './dist/tools/scraper';

// Scrape a single URL
const result = await scrapeUrl('https://example.com');
console.log(result);
// {
//   url: 'https://example.com',
//   htmlPath: '/path/to/output/www-example-com/html/_2026-02-25T12-00-00-000Z.html',
//   screenshotPath: '/path/to/output/www-example-com/screenshots/_2026-02-25T12-00-00-000Z.png',
//   timestamp: '2026-02-25T12:00:00.000Z'
// }

// Scrape multiple URLs
const results = await scrapeUrls([
  'https://example.com',
  'https://another-site.com'
]);
```

## Output Structure

```
output/
├── www-example-com/
│   ├── html/          # Captured HTML files for example.com
│   ├── screenshots/   # Full-page screenshots for example.com
│   └── analysis/      # AI-extracted section images for example.com
│       ├── 01-header.png
│       ├── 02-hero.png
│       ├── 03-content.png
│       └── 04-footer.png
├── www-eataly-com/
│   ├── html/          # Captured HTML files for eataly.com
│   ├── screenshots/   # Full-page screenshots for eataly.com
│   └── analysis/      # AI-extracted section images for eataly.com
│       ├── 01-header.png
│       ├── 02-navigation.png
│       └── 03-footer.png
└── [domain]/
    ├── html/
    ├── screenshots/
    └── analysis/
```

- Each domain gets its own subfolder (domain dots replaced with dashes)
- Files are named using the pattern: `{path}_{timestamp}`
- Section images from deconstruction are saved to `output/{domain}/analysis/`

## API

### `scrapeUrl(url: string): Promise<ScrapeResult>`

Scrapes a single URL and returns the paths to saved files.

**Parameters:**
- `url` - The URL to scrape

**Returns:**
```typescript
{
  url: string;
  htmlPath: string;
  screenshotPath: string;
  timestamp: string;
}
```

### `scrapeUrls(urls: string[]): Promise<ScrapeResult[]>`

Scrapes multiple URLs in sequence.

**Parameters:**
- `urls` - Array of URLs to scrape

**Returns:** Array of `ScrapeResult` objects

### `deconstructSite(subfolder: string): Promise<void>`

Analyzes a scraped website using Claude AI and extracts sections.

**Parameters:**
- `subfolder` - The domain folder name (e.g., "www-spacenk-com")

**Behavior:**
- Finds the latest HTML and screenshot files
- Creates `output/{subfolder}/analysis/` directory
- Compiles the Handlebars prompt template with domain context
- Invokes Claude CLI with the compiled prompt
- Claude extracts and saves section images (header, hero, content, footer)
- Outputs section-by-section analysis directly to console via Claude CLI

**Output:**
- Section images saved to `output/{subfolder}/analysis/01-header.png`, `02-hero.png`, etc.
- Detailed analysis printed to console

## Workflow Example

Complete workflow for analyzing a website:

```bash
# 1. Scrape the website
pnpm scraper https://www.spacenk.com

# 2. Deconstruct and analyze with AI
pnpm deconstructor www-spacenk-com

# The AI will:
# - Break the screenshot into sections (header, hero, content, footer)
# - Save each section as a separate image in output/www-spacenk-com/analysis/
# - Analyze visual structure and layout per section
# - Identify UI components and design patterns
# - Examine content organization
# - Review technical implementation
# - Provide recommendations for improvements
```

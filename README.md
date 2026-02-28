# Site Genie

A complete AI-powered web scraping, analysis, and code generation toolkit. Captures websites, analyzes their structure and components, and generates production-ready React code.

## Features

### 1. Scraper - Capture Full Websites
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

### 2. Deconstructor - AI-Powered Analysis
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
- 📋 Generates `manifest.json` with:
  - Component names and descriptions
  - CSS selectors for each component
  - References to HTML source and screenshots
  - Structured component hierarchy

### 3. Cropper - Live Component Extraction
- 🎯 Captures individual component screenshots from live sites
- 📸 Uses CSS selectors from manifest to isolate components
- 🔄 Revisits the live site for pixel-perfect component images
- 💾 Saves component screenshots with descriptive names
- 🥷 Uses same stealth techniques as scraper
- ⚡ Handles dynamic content and lazy-loaded images
- 🖼️ Scrolls components into view for accurate capture

### 4. Generator - React Code Generation
- ⚛️ Generates production-ready React components
- 📝 Creates TypeScript + Tailwind CSS components
- 🏗️ Generates complete page layouts
- 🤖 Uses Claude CLI for intelligent code generation
- 📋 References manifest, screenshots, and HTML source
- 🎨 Maintains visual fidelity to original design
- 📦 Outputs to your project's component directory
- ✅ Follows technical requirements and best practices
- 🔗 Two generation modes:
  - **Components**: Generate individual component files
  - **Page**: Compose components into full page layouts

## Requirements

- Node.js 18+
- pnpm
- [Claude CLI](https://docs.anthropic.com/en/docs/build-with-claude/claude-cli) (for deconstruction and generation features)
- Anthropic API key configured for Claude CLI

## Installation

```bash
pnpm install
pnpm exec playwright install chromium
```

## Usage

### 1. Scrape a Website

```bash
pnpm scrape <url>
```

Example:
```bash
pnpm scrape https://www.spacenk.com
```

This will:
- Scrape the website with full JavaScript execution
- Dismiss modals and popups
- Load all images
- Save HTML and screenshots to `output/www-spacenk-com/`

### 2. Deconstruct with AI

```bash
pnpm deconstruct <domain-folder>
```

Example:
```bash
pnpm deconstruct www-spacenk-com
```

This will:
- Find the latest HTML and screenshot from the domain folder
- Use Claude AI to analyze the website
- Break down the screenshot into individual section images
- Identify and catalog components with CSS selectors
- Generate `manifest.json` with component metadata
- Save section images to `output/www-spacenk-com/analysis/`
- Provide insights on structure, design, components, and more

To see available folders:
```bash
pnpm deconstruct
```

### 3. Crop Component Screenshots

```bash
pnpm crop <domain-folder>
```

Example:
```bash
pnpm crop www-spacenk-com
```

This will:
- Load `manifest.json` from the analysis folder
- Visit the live website using Playwright
- Use CSS selectors to locate each component
- Screenshot each component individually
- Save component images to `output/www-spacenk-com/analysis/`

### 4. Generate React Code

**Generate individual components:**
```bash
pnpm generate components <domain-folder> <project-path>
```

Example:
```bash
pnpm generate components www-spacenk-com ./storefront-next
```

This will:
- Read the manifest and component screenshots
- Use Claude CLI to generate React + TypeScript components
- Apply Tailwind CSS styling matching the original design
- Save components to `<project-path>/src/components/<merchant>/`
- Follow technical requirements and best practices
- Update manifest with `sourceFile` paths

**Generate a complete page:**
```bash
pnpm generate page <domain-folder> <project-path> <target-file> <page-name>
```

Example:
```bash
pnpm generate page www-spacenk-com ./storefront-next src/app/page.tsx HomePage
```

This will:
- Use the generated components from step 1
- Create a full page layout combining all components
- Save to the specified target file
- Import and compose components in proper order

### Programmatic Usage

```typescript
import { scrapeUrl, scrapeUrls } from './dist/tools/scraper';
import { deconstructSite } from './dist/tools/deconstructor';
import { crop } from './dist/tools/cropper';
import { generate } from './dist/tools/generator';

// 1. Scrape a single URL
const result = await scrapeUrl('https://example.com');
console.log(result);
// {
//   url: 'https://example.com',
//   htmlPath: '/path/to/output/www-example-com/html/_2026-02-25T12-00-00-000Z.html',
//   screenshotPath: '/path/to/output/www-example-com/screenshots/_2026-02-25T12-00-00-000Z.png',
//   timestamp: '2026-02-25T12:00:00.000Z'
// }

// 2. Scrape multiple URLs
const results = await scrapeUrls([
  'https://example.com',
  'https://another-site.com'
]);

// 3. Deconstruct and analyze with AI
await deconstructSite('www-example-com');
// Generates manifest.json and section images

// 4. Crop individual components from live site
await crop('www-example-com');
// Captures component screenshots using CSS selectors

// 5. Generate React components
const componentsResult = await generate({
  type: 'components',
  subfolder: 'www-example-com',
  sfNextDir: './storefront-next'
});
console.log(componentsResult);
// {
//   type: 'components',
//   subfolder: 'www-example-com',
//   outputPath: '/path/to/storefront-next/src/components/example',
//   timestamp: '2026-02-27T12:00:00.000Z'
// }

// 6. Generate page layout
const pageResult = await generate({
  type: 'page',
  subfolder: 'www-example-com',
  sfNextDir: './storefront-next',
  targetFile: 'src/app/page.tsx',
  pageName: 'HomePage'
});
```

## Output Structure

```
output/
├── www-example-com/
│   ├── html/                          # Captured HTML files
│   │   └── _2026-02-27T12-00-00.html
│   ├── screenshots/                   # Full-page screenshots
│   │   └── _2026-02-27T12-00-00.png
│   ├── analysis/                      # Component analysis
│   │   ├── manifest.json             # Component catalog with selectors
│   │   ├── 01-Header.png             # Section screenshots
│   │   ├── 02-Hero.png
│   │   ├── 03-ProductGrid.png
│   │   ├── 04-Footer.png
│   │   ├── Header.png                # Component screenshots (from cropper)
│   │   ├── Hero.png
│   │   ├── ProductGrid.png
│   │   └── Footer.png
│   └── prompts/                       # Generated prompts (for transparency)
│       ├── generate-components.md
│       └── generate-page.md
└── [domain]/
    ├── html/
    ├── screenshots/
    ├── analysis/
    └── prompts/
```

**Project output structure (when using generator):**
```
storefront-next/
└── src/
    ├── components/
    │   └── example/                   # Merchant-specific components
    │       ├── Header.tsx
    │       ├── Hero.tsx
    │       ├── ProductGrid.tsx
    │       └── Footer.tsx
    └── routes/
        └── page.tsx                   # Generated page using components
```

**Key files:**
- `manifest.json` - Component catalog with names, descriptions, CSS selectors, and file paths
- Section images (e.g., `01-Header.png`) - AI-extracted from full screenshot
- Component images (e.g., `Header.png`) - Cropped from live site using selectors
- Prompt files - Full prompts sent to Claude for transparency and debugging

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
- Generates `manifest.json` with component metadata
- Outputs section-by-section analysis directly to console via Claude CLI

**Output:**
- Section images saved to `output/{subfolder}/analysis/01-header.png`, `02-hero.png`, etc.
- `manifest.json` with component names, descriptions, and CSS selectors
- Detailed analysis printed to console

### `crop(subfolder: string): Promise<void>`

Captures individual component screenshots from the live site using CSS selectors.

**Parameters:**
- `subfolder` - The domain folder name (e.g., "www-spacenk-com")

**Behavior:**
- Loads `manifest.json` from `output/{subfolder}/analysis/`
- Navigates to the live site using Playwright
- Uses stealth techniques to avoid bot detection
- Locates each component by CSS selector from manifest
- Scrolls component into view and screenshots it
- Saves component images with descriptive names

**Output:**
- Component images saved to `output/{subfolder}/analysis/Header.png`, `Hero.png`, etc.

### `generate(options: GeneratorOptions): Promise<GenerateResult>`

Generates React components or pages using Claude AI.

**Parameters:**
```typescript
interface GeneratorOptions {
  type: 'components' | 'page';
  subfolder: string;
  sfNextDir: string;
  targetFile?: string;  // Required for 'page' type
  pageName?: string;    // Required for 'page' type
}
```

**Behavior (components mode):**
- Reads `manifest.json` and component screenshots
- Compiles Handlebars prompt template with technical requirements
- Invokes Claude CLI to generate TypeScript + Tailwind components
- Saves components to `{sfNextDir}/src/components/{merchant}/`
- Updates manifest with `sourceFile` paths

**Behavior (page mode):**
- Uses existing component source files from manifest
- Generates a full page layout composing all components
- Saves to specified `targetFile` in the project

**Returns:**
```typescript
{
  type: 'components' | 'page';
  subfolder: string;
  outputPath: string;
  timestamp: string;
}
```

**Output:**
- React component files (`.tsx`)
- Generated prompt saved to `output/{subfolder}/prompts/` for transparency

## Complete Workflow

End-to-end workflow for scraping a website and generating React code:

```bash
# 1. Scrape the website
pnpm scrape https://www.spacenk.com
# Output: HTML + screenshot saved to output/www-spacenk-com/

# 2. Deconstruct and analyze with AI
pnpm deconstruct www-spacenk-com
# Output: Section images + manifest.json in output/www-spacenk-com/analysis/
# The AI will:
# - Break the screenshot into sections (header, hero, content, footer)
# - Identify components with CSS selectors
# - Generate manifest.json with component metadata
# - Provide detailed analysis of structure and design

# 3. Crop individual components from live site
pnpm crop www-spacenk-com
# Output: Component images (Header.png, Hero.png, etc.) in analysis/
# Uses CSS selectors from manifest to capture pixel-perfect component screenshots

# 4. Generate React components
pnpm generate components www-spacenk-com ./storefront-next
# Output: TypeScript + Tailwind components in storefront-next/src/components/spacenk/
# Components: Header.tsx, Hero.tsx, ProductGrid.tsx, Footer.tsx, etc.

# 5. Generate page layout
pnpm generate page www-spacenk-com ./storefront-next src/app/page.tsx HomePage
# Output: Complete page in storefront-next/src/app/page.tsx
# Imports and composes all generated components
```

**What you get:**
- ✅ Fully scraped website (HTML + screenshots)
- ✅ Component catalog with CSS selectors (`manifest.json`)
- ✅ Individual component images from live site
- ✅ Production-ready React + TypeScript components
- ✅ Complete page layout using your components
- ✅ Tailwind CSS styling matching original design
- ✅ All files organized and ready to use

**Quick workflow (if you know what you want):**
```bash
# Run all steps in sequence
pnpm scrape https://www.spacenk.com && \
pnpm deconstruct www-spacenk-com && \
pnpm crop www-spacenk-com && \
pnpm generate components www-spacenk-com ./storefront-next && \
pnpm generate page www-spacenk-com ./storefront-next src/app/page.tsx HomePage
```

## Advanced Features

### Handlebars Prompt Templates

Site Genie uses Handlebars templates to generate dynamic prompts for Claude AI:

- **`src/prompts/deconstruct.hbs`** - Template for website analysis
- **`src/prompts/generate-components.hbs`** - Template for component generation
- **`src/prompts/generate-page.hbs`** - Template for page generation

Templates receive context including:
- Domain and subfolder information
- Paths to HTML source and screenshots
- Component metadata from manifest
- Technical requirements

Generated prompts are saved to `output/{domain}/prompts/` for transparency and debugging.

### Technical Requirements

The `src/prompts/technical-requirements.md` file defines:
- React and TypeScript conventions
- Tailwind CSS usage guidelines
- Component structure and best practices
- Accessibility requirements
- Performance considerations

These requirements are automatically included in all generation prompts to ensure consistent, high-quality output.

### Manifest System

The `manifest.json` file serves as the central source of truth:

```json
{
  "htmlSource": "output/www-example-com/html/_2026-02-27.html",
  "screenshot": "output/www-example-com/screenshots/_2026-02-27.png",
  "components": [
    {
      "name": "01-Header",
      "description": "Main navigation header with logo and menu",
      "cssSelector": "header.main-header",
      "sourceFile": "storefront-next/src/components/example/Header.tsx"
    }
  ]
}
```

**Used by:**
- **Cropper**: Reads CSS selectors to capture components
- **Generator**: References screenshots and metadata
- **You**: Track component details and file locations

## CLI Reference

All tools are available as npm scripts via `pnpm`:

### Scraper
```bash
pnpm scrape <url>
```
Captures HTML and screenshot of a website.

### Deconstructor
```bash
pnpm deconstruct [subfolder]
```
Analyzes a scraped website with Claude AI. Omit `subfolder` to list available domains.

### Cropper
```bash
pnpm crop <subfolder>
```
Captures individual component screenshots from live site using manifest selectors.

### Generator
```bash
# Generate components
pnpm generate components <subfolder> <project-path>

# Generate page
pnpm generate page <subfolder> <project-path> <target-file> <page-name>
```
Generates React code using Claude AI based on analysis and screenshots.

## Project Structure

```
site-genie/
├── src/
│   ├── tools/
│   │   ├── scraper.ts        # Web scraping with Playwright
│   │   ├── deconstructor.ts  # AI analysis and component identification
│   │   ├── cropper.ts        # Component screenshot capture
│   │   └── generator.ts      # React code generation
│   └── prompts/
│       ├── deconstruct.hbs            # Analysis prompt template
│       ├── generate-components.hbs    # Component generation template
│       ├── generate-page.hbs          # Page generation template
│       └── technical-requirements.md  # Code standards
├── output/                    # Generated output by domain
└── package.json              # npm scripts and dependencies
```

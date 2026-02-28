#!/usr/bin/env node

import { chromium } from 'playwright';
import { readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createStealthBrowser, createStealthContext, preparePageForScreenshot } from './scraper.js';

interface ManifestComponent {
  name: string;
  cssSelector?: string;
  description?: string;
  [key: string]: unknown;
}

interface Manifest {
  htmlSource?: string;
  screenshot?: string;
  components: ManifestComponent[];
}

/**
 * Converts a subfolder name (e.g. www-spacenk-com) to a hostname (e.g. www.spacenk.com).
 */
function subfolderToHostname(subfolder: string): string {
  return subfolder.replace(/-/g, '.');
}

/**
 * Loads and parses manifest.json from output/[subfolder]/analysis/.
 */
async function loadManifest(subfolder: string): Promise<Manifest> {
  const manifestPath = join(process.cwd(), 'output', subfolder, 'analysis', 'manifest.json');
  const raw = await readFile(manifestPath, 'utf-8');
  return JSON.parse(raw) as Manifest;
}

/**
 * Crops each component from the live page: visit URL, find element by selector, screenshot, save to analysis folder.
 */
export async function crop(subfolder: string): Promise<void> {
  const hostname = subfolderToHostname(subfolder);
  const url = `https://${hostname}`;
  const analysisDir = join(process.cwd(), 'output', subfolder, 'analysis');

  const manifest = await loadManifest(subfolder);
  const components = manifest.components ?? [];

  if (components.length === 0) {
    console.log('No components in manifest.');
    return;
  }

  await mkdir(analysisDir, { recursive: true });

  const browser = await createStealthBrowser();
  const context = await createStealthContext(browser);

  try {
    const page = await context.newPage();
    console.log(`Navigating to ${url}...`);

    // Navigate with fallback strategies
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (error) {
      console.log('Networkidle timeout, trying with domcontentloaded...');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    }

    // Wait for the page to be fully interactive
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {
      console.log('Load state timeout, continuing anyway...');
    });

    // Prepare page for screenshots (dismisses modals, scrolls to trigger lazy-load, waits for images)
    await preparePageForScreenshot(page);

    for (const component of components) {
      const selector = component.cssSelector;
      const name = component.name;

      if (!selector) {
        console.warn(`Skipping "${name}": no cssSelector`);
        continue;
      }

      try {
        const locator = page.locator(selector).first();
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.scrollIntoViewIfNeeded();
        // Wait for any lazy-loaded images in this component to load
        await page.waitForTimeout(500);
        const pngPath = join(analysisDir, `${name}.png`);
        await locator.screenshot({ path: pngPath, type: 'png' });
        console.log(`Saved: ${name}.png`);
      } catch (err) {
        console.warn(`Skipping "${name}" (selector: ${selector}): ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const subfolder = process.argv[2];
  if (!subfolder) {
    console.error('Usage: cropper <subfolder>');
    console.error('Example: cropper www-spacenk-com');
    process.exit(1);
  }
  await crop(subfolder);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

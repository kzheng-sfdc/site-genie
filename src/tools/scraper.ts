#!/usr/bin/env node

import { chromium, devices, Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface ScrapeResult {
  url: string;
  htmlPath: string;
  screenshotPath: string;
  timestamp: string;
}

/**
 * Gets a realistic user agent string
 */
function getRealisticUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Gets a sanitized domain name from a URL
 */
function getDomainFolder(url: string): string {
  const urlObj = new URL(url);
  return urlObj.hostname.replace(/\./g, '-');
}

/**
 * Generates a safe filename from a URL
 */
function generateFilename(url: string): string {
  const urlObj = new URL(url);
  const path = urlObj.pathname.replace(/\//g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${path}_${timestamp}`;
}

/**
 * Ensures output directories exist for a specific domain
 */
async function ensureOutputDirectories(domain: string): Promise<void> {
  const outputDir = join(process.cwd(), 'output', domain);
  const htmlDir = join(outputDir, 'html');
  const screenshotsDir = join(outputDir, 'screenshots');

  await mkdir(htmlDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
}

/**
 * Scrolls through the page to trigger lazy-loaded images
 */
export async function triggerLazyLoadedImages(page: Page): Promise<void> {
  console.log('Scrolling to trigger lazy-loaded images...');

  await page.evaluate(async () => {
    // Get the full page height
    const getScrollHeight = () => document.documentElement.scrollHeight;

    let scrollHeight = getScrollHeight();
    let currentPosition = 0;
    const scrollStep = 500; // Scroll 500px at a time

    // Scroll down in increments
    while (currentPosition < scrollHeight) {
      window.scrollTo(0, currentPosition);
      currentPosition += scrollStep;
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms between scrolls

      // Recalculate scroll height in case content loaded
      scrollHeight = getScrollHeight();
    }

    // Scroll to the bottom
    window.scrollTo(0, scrollHeight);
    await new Promise(resolve => setTimeout(resolve, 500));
  });
}

/**
 * Waits for images to load on the page
 */
export async function waitForImages(page: Page, timeoutMs: number = 10000): Promise<void> {
  console.log('Waiting for images to load...');

  try {
    await page.evaluate((timeout) => {
      return new Promise<void>((resolve) => {
        const startTime = Date.now();

        const checkImages = () => {
          const images = Array.from(document.querySelectorAll('img'));

          // Filter out images that are hidden or have 0 dimensions
          const visibleImages = images.filter(img => {
            const rect = img.getBoundingClientRect();
            const style = window.getComputedStyle(img);
            return style.display !== 'none' &&
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0' &&
                   (rect.width > 0 || rect.height > 0);
          });

          if (visibleImages.length === 0) {
            resolve();
            return;
          }

          // Check if all visible images are loaded
          const allLoaded = visibleImages.every(img => {
            return img.complete && img.naturalHeight > 0;
          });

          if (allLoaded || Date.now() - startTime > timeout) {
            const loadedCount = visibleImages.filter(img => img.complete && img.naturalHeight > 0).length;
            console.log(`Loaded ${loadedCount}/${visibleImages.length} images`);
            resolve();
          } else {
            setTimeout(checkImages, 200);
          }
        };

        checkImages();
      });
    }, timeoutMs);

    console.log('Images loaded successfully');
  } catch (error) {
    console.log('Image loading check completed with timeout');
  }
}

/**
 * Attempts to dismiss common modals, popups, and consent dialogs
 */
export async function dismissModals(page: Page): Promise<void> {
  console.log('Checking for modals and popups...');

  // Wait a moment for modals to appear
  await page.waitForTimeout(2000);

  // Common selectors for close buttons and accept buttons
  const dismissSelectors = [
    // Close buttons (X)
    '[class*="close"]',
    '[class*="Close"]',
    '[id*="close"]',
    '[aria-label*="close" i]',
    '[aria-label*="dismiss" i]',
    'button[title*="close" i]',
    '.modal-close',
    '.popup-close',

    // Accept/Consent buttons
    'button:has-text("Accept")',
    'button:has-text("I Accept")',
    'button:has-text("I Agree")',
    'button:has-text("Accept All")',
    'button:has-text("Agree")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("Continue")',
    'a:has-text("Accept")',
    '[id*="accept"]',
    '[class*="accept"]',

    // Cookie consent specific
    '#onetrust-accept-btn-handler',
    '.cookie-consent-accept',
    '#cookie-consent-accept',
    '[aria-label*="accept cookie" i]',

    // No thanks / Skip buttons
    'button:has-text("No thanks")',
    'button:has-text("No Thanks")',
    'button:has-text("Skip")',
    'button:has-text("Maybe Later")',
    'button:has-text("Not now")',

    // Generic modal overlays with close buttons
    '[role="dialog"] button[aria-label*="close" i]',
    '[role="dialog"] [class*="close"]',
    '.modal button[class*="close"]',

    // Email signup dismissals
    '[aria-label*="Close dialog" i]',
    '[aria-label*="Close popup" i]',
    'button.klaviyo-close-form',
  ];

  let dismissed = 0;

  for (const selector of dismissSelectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 1000 })) {
        await element.click({ timeout: 2000 });
        dismissed++;
        console.log(`Dismissed element: ${selector}`);
        // Wait for the modal to close
        await page.waitForTimeout(1000);
      }
    } catch (error) {
      // Element not found or not clickable, continue to next selector
    }
  }

  // Try to press Escape key to close modals
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    dismissed++;
    console.log('Pressed Escape key');
  } catch (error) {
    // Ignore
  }

  if (dismissed > 0) {
    console.log(`Dismissed ${dismissed} modal(s)/popup(s)`);
  } else {
    console.log('No modals detected');
  }
}

/**
 * Creates a browser instance with stealth settings optimized for scraping
 */
export async function createStealthBrowser() {
  return await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

/**
 * Creates a browser context with realistic fingerprint and stealth measures
 */
export async function createStealthContext(browser: any) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: getRealisticUserAgent(),
    locale: 'en-US',
    timezoneId: 'America/New_York',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    permissions: ['geolocation', 'notifications'],
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
  });

  // Add additional stealth measures
  await context.addInitScript(() => {
    // Override the navigator.webdriver property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Remove automation-related properties
    delete (navigator as any).__proto__.webdriver;

    // Mock plugins to look like a real browser
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Plugin',
        },
        {
          0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          description: 'Chromium PDF Viewer',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          length: 1,
          name: 'Chromium PDF Viewer',
        },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Add chrome object with more properties
    (window as any).chrome = {
      app: {},
      runtime: {
        connect: () => {},
        sendMessage: () => {},
      },
      loadTimes: () => {},
      csi: () => {},
    };

    // Mock permissions
    const originalQuery = (window.navigator.permissions as any).query;
    (window.navigator.permissions as any).query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'prompt' })
        : originalQuery(parameters);

    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });

    // Mock device memory
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => 8,
    });

    // Override automation-related properties
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel',
    });

    // Mock window.outerWidth and outerHeight to look realistic
    Object.defineProperty(window, 'outerWidth', {
      get: () => 1920,
    });
    Object.defineProperty(window, 'outerHeight', {
      get: () => 1080,
    });

    // Mock screen properties
    Object.defineProperty(window.screen, 'availWidth', {
      get: () => 1920,
    });
    Object.defineProperty(window.screen, 'availHeight', {
      get: () => 1055,
    });

    // Override HTMLImageElement loading attribute to force eager loading
    Object.defineProperty(HTMLImageElement.prototype, 'loading', {
      get: function() {
        return 'eager';
      },
      set: function(value) {
        // Ignore attempts to set lazy loading
      },
      configurable: true,
    });

    // Mask WebGL vendor and renderer to look like a real GPU
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) {
        return 'Intel Inc.';
      }
      if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
      }
      return getParameter.call(this, parameter);
    };
  });

  return context;
}

/**
 * Prepares a page for screenshot capture by handling modals, scrolling, and waiting for images
 */
export async function preparePageForScreenshot(page: Page): Promise<void> {
  // Dismiss any modals, popups, or consent dialogs
  await dismissModals(page);

  // Scroll through the page to trigger lazy-loaded images
  await triggerLazyLoadedImages(page);

  // Wait for images to load
  await waitForImages(page, 15000);
}

/**
 * Detects if page is showing a Cloudflare or other bot protection challenge
 */
async function detectBotProtection(page: Page): Promise<{ detected: boolean; type?: string }> {
  const indicators = await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    const title = document.title.toLowerCase();

    // Check for Cloudflare
    const hasCloudflare = bodyText.includes('cloudflare') ||
                          bodyText.includes('checking your browser') ||
                          bodyText.includes('security verification') ||
                          bodyText.includes('just a moment') ||
                          title.includes('just a moment');

    // Check for other protections
    const hasDatadome = bodyText.includes('datadome');
    const hasPerimeterX = bodyText.includes('perimeterx') || bodyText.includes('px-captcha');
    const hasRecaptcha = document.querySelector('.g-recaptcha') !== null;

    return {
      cloudflare: hasCloudflare,
      datadome: hasDatadome,
      perimeterx: hasPerimeterX,
      recaptcha: hasRecaptcha,
    };
  });

  if (indicators.cloudflare) {
    return { detected: true, type: 'Cloudflare' };
  } else if (indicators.datadome) {
    return { detected: true, type: 'DataDome' };
  } else if (indicators.perimeterx) {
    return { detected: true, type: 'PerimeterX' };
  } else if (indicators.recaptcha) {
    return { detected: true, type: 'reCAPTCHA' };
  }

  return { detected: false };
}

/**
 * Waits for Cloudflare challenge to complete
 */
async function waitForCloudflareChallenge(page: Page, timeoutMs: number = 30000): Promise<boolean> {
  console.log('Waiting for Cloudflare challenge to complete...');

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const protection = await detectBotProtection(page);

    if (!protection.detected) {
      console.log('✓ Challenge completed successfully');
      return true;
    }

    // Wait before checking again
    await page.waitForTimeout(1000);

    // Log progress every 5 seconds
    if ((Date.now() - startTime) % 5000 < 1000) {
      console.log(`Still waiting for ${protection.type} challenge... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
    }
  }

  console.log('⚠ Challenge timeout - continuing anyway');
  return false;
}

/**
 * Scrapes a given URL, captures HTML after JavaScript execution,
 * and takes a full-page screenshot
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  console.log(`Starting scrape for: ${url}`);

  // Get domain folder and ensure output directories exist
  const domainFolder = getDomainFolder(url);
  await ensureOutputDirectories(domainFolder);

  const startTime = Date.now();

  // Launch browser with realistic settings
  const browser = await createStealthBrowser();

  try {
    // Create context with realistic browser fingerprint
    const context = await createStealthContext(browser);

    const page = await context.newPage();

    // Set additional headers for this page
    await page.setExtraHTTPHeaders({
      'Referer': new URL(url).origin,
    });

    // Random delay before navigation to appear more human-like
    const preNavigationDelay = 1000 + Math.random() * 2000;
    console.log(`Waiting ${(preNavigationDelay / 1000).toFixed(1)}s before navigation...`);
    await page.waitForTimeout(preNavigationDelay);

    // Navigate to URL with fallback strategies
    console.log('Loading page...');
    try {
      // First try with networkidle (works for most sites)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (error) {
      console.log('Navigation error, retrying...');
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: 30000,
      });
    }

    // Wait a moment for page to start rendering
    await page.waitForTimeout(2000);

    // Check for bot protection
    const protection = await detectBotProtection(page);
    if (protection.detected) {
      console.log(`⚠ ${protection.type} protection detected`);
      await waitForCloudflareChallenge(page, 30000);
    }

    // Wait for the page to be fully interactive
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {
      console.log('Load state timeout, continuing anyway...');
    });

    // Additional wait for any remaining network activity
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('Network idle timeout, continuing...');
    });

    // Simulate human-like behavior with random scroll
    await page.evaluate(() => {
      window.scrollTo(0, Math.floor(Math.random() * 500));
    });

    // Wait a bit more to ensure all JavaScript has executed
    await page.waitForTimeout(3000 + Math.random() * 2000);

    // Prepare page for screenshot (dismisses modals, scrolls, waits for images)
    await preparePageForScreenshot(page);

    // Scroll back to top for screenshot
    console.log('Scrolling back to top...');
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1000);

    // Final check for bot protection
    const finalProtection = await detectBotProtection(page);
    if (finalProtection.detected) {
      console.warn(`\n⚠ WARNING: ${finalProtection.type} protection still detected!`);
      console.warn('The page may not have loaded correctly. Check the screenshot and HTML output.');
      console.warn('You may need to:');
      console.warn('  1. Use a different scraping approach (e.g., residential proxies)');
      console.warn('  2. Contact the site owner for API access');
      console.warn('  3. Try again later\n');
    }

    // Generate filename
    const filename = generateFilename(url);

    // Capture HTML
    console.log('Capturing HTML...');
    const html = await page.content();
    const htmlPath = join(process.cwd(), 'output', domainFolder, 'html', `${filename}.html`);
    await writeFile(htmlPath, html, 'utf-8');
    console.log(`HTML saved to: ${htmlPath}`);

    // Capture full-page screenshot
    console.log('Capturing screenshot...');
    const screenshotPath = join(process.cwd(), 'output', domainFolder, 'screenshots', `${filename}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    await context.close();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nCompleted in ${duration}s`);

    return {
      url,
      htmlPath,
      screenshotPath,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`\nError during scraping:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Scrapes multiple URLs in sequence
 */
export async function scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];

  for (const url of urls) {
    try {
      const result = await scrapeUrl(url);
      results.push(result);
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error);
      throw error;
    }
  }

  return results;
}

// CLI execution
if (require.main === module) {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: pnpm scraper <url>');
    process.exit(1);
  }

  scrapeUrl(url)
    .then((result) => {
      console.log('\n✓ Scraping completed successfully!');
      console.log('Results:', result);
    })
    .catch((error) => {
      console.error('Scraping failed:', error);
      process.exit(1);
    });
}

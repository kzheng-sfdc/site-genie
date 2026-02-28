#!/usr/bin/env node

import { scrapeUrl } from './scraper.js';
import { deconstructSite } from './deconstructor.js';
import { crop } from './cropper.js';
import { generate } from './generator.js';

/**
 * Gets a sanitized domain name from a URL (same logic as scraper)
 */
function getDomainFolder(url: string): string {
  const urlObj = new URL(url);
  return urlObj.hostname.replace(/\./g, '-');
}

/**
 * Runs the complete Site Genie workflow:
 * 1. Scrape the website
 * 2. Deconstruct with AI
 * 3. Crop component screenshots
 * 4. Generate React components
 * 5. Generate page layout
 */
async function start(
  url: string,
  sfNextDir: string,
  targetFile: string,
  pageName: string
): Promise<void> {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log('🧞 SITE GENIE - Complete Workflow');
  console.log('='.repeat(80));
  console.log(`URL: ${url}`);
  console.log(`Storefront Directory: ${sfNextDir}`);
  console.log(`Target File: ${targetFile}`);
  console.log(`Page Name: ${pageName}`);
  console.log('='.repeat(80) + '\n');

  // Derive the subfolder from the URL
  const subfolder = getDomainFolder(url);
  console.log(`📁 Domain folder: ${subfolder}\n`);

  try {
    // Step 1: Scrape
    console.log('\n' + '─'.repeat(80));
    console.log('📸 STEP 1/5: Scraping website...');
    console.log('─'.repeat(80) + '\n');
    await scrapeUrl(url);

    // Step 2: Deconstruct
    console.log('\n' + '─'.repeat(80));
    console.log('🔍 STEP 2/5: Deconstructing with AI...');
    console.log('─'.repeat(80) + '\n');
    await deconstructSite(subfolder);

    // Step 3: Crop
    console.log('\n' + '─'.repeat(80));
    console.log('✂️  STEP 3/5: Cropping component screenshots...');
    console.log('─'.repeat(80) + '\n');
    await crop(subfolder);

    // Step 4: Generate Components
    console.log('\n' + '─'.repeat(80));
    console.log('⚛️  STEP 4/5: Generating React components...');
    console.log('─'.repeat(80) + '\n');
    await generate({
      type: 'components',
      subfolder,
      sfNextDir,
    });

    // Step 5: Generate Page
    console.log('\n' + '─'.repeat(80));
    console.log('📄 STEP 5/5: Generating page layout...');
    console.log('─'.repeat(80) + '\n');
    await generate({
      type: 'page',
      subfolder,
      sfNextDir,
      targetFile,
      pageName,
    });

    // Success
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(80));
    console.log('✨ COMPLETE! Site Genie workflow finished successfully!');
    console.log('='.repeat(80));
    console.log(`⏱️  Total time: ${duration}s`);
    console.log('\n📦 Output locations:');
    console.log(`   - Analysis: output/${subfolder}/analysis/`);
    console.log(`   - Components: ${sfNextDir}/src/components/${subfolder.split('-')[1]}/`);
    console.log(`   - Page: ${sfNextDir}/src/routes/${targetFile}`);
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ Site Genie workflow failed!');
    console.error('='.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

// CLI execution
if (require.main === module) {
  const url = process.argv[2];
  const sfNextDir = process.argv[3];
  const targetFile = process.argv[4];
  const pageName = process.argv[5];

  if (!url || !sfNextDir || !targetFile || !pageName) {
    console.error('Usage: pnpm start <url> <sfNextDir> <targetFile> <pageName>');
    console.error('\nArguments:');
    console.error('  url         - Website URL to scrape (e.g., https://www.spacenk.com)');
    console.error('  sfNextDir   - Storefront Next project directory (e.g., storefront-next)');
    console.error('  targetFile  - Target page file (e.g., _empty.home.tsx)');
    console.error('  pageName    - Page component name (e.g., SpaceNXHome)');
    console.error('\nExample:');
    console.error('  pnpm start https://www.spacenk.com storefront-next _empty.home.tsx SpaceNXHome');
    console.error('\nThis will run the complete workflow:');
    console.error('  1. Scrape the website (HTML + screenshots)');
    console.error('  2. Deconstruct with AI (analyze structure, extract components)');
    console.error('  3. Crop component screenshots from live site');
    console.error('  4. Generate React components (TypeScript + Tailwind)');
    console.error('  5. Generate page layout (compose all components)');
    process.exit(1);
  }

  start(url, sfNextDir, targetFile, pageName).catch((error) => {
    console.error('Start script failed:', error);
    process.exit(1);
  });
}

export { start };

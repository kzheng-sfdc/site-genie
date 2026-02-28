#!/usr/bin/env node

import { readdir, readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import path from 'path';
import Handlebars from 'handlebars';

/**
 * Gets the most recent file from a directory
 */
async function getLatestFile(dirPath: string, extension: string): Promise<string | null> {
  try {
    const files = await readdir(dirPath);
    const matchingFiles = files
      .filter(f => f.endsWith(extension))
      .map(f => join(dirPath, f));

    if (matchingFiles.length === 0) {
      return null;
    }

    // Sort by filename (which includes timestamp) to get the latest
    matchingFiles.sort();
    return matchingFiles[matchingFiles.length - 1];
  } catch (error) {
    return null;
  }
}

/**
 * Deconstructs a scraped website by analyzing it with Claude
 */
export async function deconstructSite(subfolder: string): Promise<void> {
  console.log(`Deconstructing site from folder: ${subfolder}\n`);

  // Construct paths
  const outputDir = join(process.cwd(), 'output', subfolder);
  const htmlDir = join(outputDir, 'html');
  const screenshotsDir = join(outputDir, 'screenshots');
  const analysisDir = join(outputDir, 'analysis');
  const templatePath = join(process.cwd(), 'src', 'prompts', 'deconstruct.hbs');

  // Ensure analysis directory exists
  await mkdir(analysisDir, { recursive: true });

  // Get the latest HTML file
  console.log('Finding latest HTML file...');
  const htmlFile = await getLatestFile(htmlDir, '.html');
  if (!htmlFile) {
    throw new Error(`No HTML files found in ${htmlDir}`);
  }
  console.log(`✓ Found: ${htmlFile}`);

  // Get the latest screenshot
  console.log('Finding latest screenshot...');
  const screenshotFile = await getLatestFile(screenshotsDir, '.png');
  if (!screenshotFile) {
    throw new Error(`No screenshot files found in ${screenshotsDir}`);
  }
  console.log(`✓ Found: ${screenshotFile}`);

  const context = {
    htmlSource: path.resolve(htmlFile),
    screenshot: path.resolve(screenshotFile),
    domain: `${subfolder.replace(/-/g, '.')}`,
  };

  const prompt = Handlebars.compile(await readFile(templatePath, 'utf-8'))(context);

  // Write Claude prompt to subfolder/prompts/deconstruct.md
  const promptOutputDir = join(process.cwd(), 'output', subfolder, 'prompts');
  const promptOutputPath = join(promptOutputDir, 'deconstruct.md');
  await mkdir(promptOutputDir, { recursive: true });
  await writeFile(promptOutputPath, prompt, 'utf-8');
  console.log(`\n✓ Wrote Claude deconstruction prompt to: ${promptOutputPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('Invoking Claude CLI with:');
  console.log(`- Domain: ${subfolder}`);
  console.log(`- HTML: ${htmlFile}`);
  console.log(`- Screenshot: ${screenshotFile}`);
  console.log(`- Analysis output: ${analysisDir}`);
  console.log('='.repeat(60) + '\n');

  // Build the claude command
  const command = `cat ${promptOutputPath} | claude -p`;

  // Execute the claude process
  try {
    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);
    // Find the first occurrence between ``` fence blocks (optionally specifying json after ```)
    const matches = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matches && matches[1]) {
      let manifestJsonStr = matches[1];
      // Try to format/parse to pretty JSON to validate and normalize
      try {
        const manifestObj = JSON.parse(manifestJsonStr);
        manifestJsonStr = JSON.stringify(manifestObj, null, 2);
      } catch (e) {
        // Not valid JSON, just save as is
      }
      const manifestOutputPath = join(analysisDir, 'manifest.json');
      await writeFile(manifestOutputPath, manifestJsonStr, 'utf-8');
      console.log(`\n✓ Saved manifest.json to: ${manifestOutputPath}`);
    } else {
      console.warn('\n⚠️ No JSON manifest found in Claude output (```...``` block missing)');
    }
    console.log('\nDeconstruction completed successfully!');
    console.log('='.repeat(60));
  } catch (error: any) {
    throw new Error(`Claude CLI failed: ${error.message}`);
  }
}

// CLI execution
if (require.main === module) {
  const subfolder = process.argv[2];

  if (!subfolder) {
    console.error('Usage: pnpm deconstructor <subfolder>');
    console.error('\nExample: pnpm deconstructor www-spacenk-com');
    console.error('\nAvailable subfolders:');

    // List available subfolders
    const outputDir = join(process.cwd(), 'output');
    readdir(outputDir).then(folders => {
      folders.forEach(folder => {
        console.error(`  - ${folder}`);
      });
    }).catch(() => {
      console.error('  (No output folders found)');
    }).finally(() => {
      process.exit(1);
    });
  } else {
    deconstructSite(subfolder)
      .catch((error) => {
        console.error('\n❌ Deconstruction failed:', error.message);
        process.exit(1);
      });
  }
}

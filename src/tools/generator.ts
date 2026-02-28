#!/usr/bin/env node

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import Handlebars from 'handlebars';

type GenerationType = 'components' | 'page';

interface GeneratorOptions {
  type: GenerationType;
  subfolder: string;
  sfNextDir: string;
  targetFile?: string;  // Required for 'page' type
  pageName?: string;    // Required for 'page' type
}

interface GenerateResult {
  type: GenerationType;
  subfolder: string;
  outputPath: string;
  timestamp: string;
}

/**
 * Generates React components based on the manifest and analysis files
 */
async function generateComponents(subfolder: string, sfNextDir: string): Promise<GenerateResult> {
  console.log(`Generating components for: ${subfolder}`);

  // extract the merchant name from the subfolder, which is the second part of the domain
  const domain = subfolder.replace(/-/g, '.');
  const merchantName = domain.split('.')[1].toLowerCase();

  // Construct paths
  const outputDir = join(process.cwd(), 'output', subfolder);
  const analysisDir = join(outputDir, 'analysis');
  const componentsOutputDir = join(sfNextDir, 'src', 'components', merchantName);
  const templatePath = join(process.cwd(), 'src', 'prompts', 'generate-components.hbs');

  // Ensure components output directory exists
  await mkdir(componentsOutputDir, { recursive: true });

  // 1. Read manifest file
  console.log('Reading manifest file...');
  const manifestPath = join(analysisDir, 'manifest.json');
  const manifestContent = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
  console.log(`✓ Found manifest with ${manifest.components.length} components`);

  // 2. Read technical requirements file
  const technicalRequirementsPath = join(process.cwd(), 'src', 'prompts', 'technical-requirements.md');
  const technicalRequirementsContent = await readFile(technicalRequirementsPath, 'utf-8');
  const technicalRequirements = technicalRequirementsContent.trim();

  // 3. Build components array with screenshot paths
  console.log('Mapping component screenshots...');
  const components = manifest.components.map((component: any) => {
    const screenshotPath = join(analysisDir, `${component.name}.png`);
    return {
      name: component.name,
      screenshot: path.resolve(screenshotPath),
    };
  });

  // 4. Prepare template context
  const context = {
    manifest: path.resolve(manifestPath),
    htmlSource: path.resolve(manifest.htmlSource),
    screenshot: path.resolve(manifest.screenshot),
    components,
    targetDir: path.resolve(componentsOutputDir),
    technicalRequirements,
  };

  console.log('Template context:');
  console.log(`  - Manifest: ${context.manifest}`);
  console.log(`  - HTML Source: ${context.htmlSource}`);
  console.log(`  - Screenshot: ${context.screenshot}`);
  console.log(`  - Target directory: ${context.targetDir}`);
  console.log(`  - Components: ${components.length}`);

  // 5. Compile Handlebars template
  console.log('\nCompiling Handlebars template...');
  const templateContent = await readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  const prompt = template(context);

  // Write prompt to prompts directory for transparency
  const promptOutputDir = join(outputDir, 'prompts');
  const promptOutputPath = join(promptOutputDir, 'generate-components.md');
  await mkdir(promptOutputDir, { recursive: true });
  await writeFile(promptOutputPath, prompt, 'utf-8');
  console.log(`✓ Wrote component generation prompt to: ${promptOutputPath}`);

  // 6. Call Claude CLI to generate components
  console.log('\n' + '='.repeat(60));
  console.log('Invoking Claude CLI to generate components...');
  console.log('='.repeat(60) + '\n');

  const command = `cat ${promptOutputPath} | claude -p --permission-mode acceptEdits`;

  try {
    execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit', // Show Claude's output in real-time
    });

    console.log('\n' + '='.repeat(60));
    console.log('Component generation completed!');
    console.log('='.repeat(60));
  } catch (error: any) {
    throw new Error(`Claude CLI failed: ${error.message}`);
  }

  // Update manifest with sourceFile paths for each component
  console.log('\nUpdating manifest with component source file paths...');
  manifest.components = manifest.components.map((component: any) => {
    // Remove leading numeric prefix with dash (e.g., "01-Component" -> "Component")
    const strippedName = component.name.replace(/^\d+-/, '');
    const componentFileName = `${strippedName}.tsx`;
    const componentFilePath = join(componentsOutputDir, componentFileName);

    return {
      ...component,
      sourceFile: path.resolve(componentFilePath),
    };
  });

  // Write updated manifest back to file
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`✓ Updated manifest with source file paths: ${manifestPath}`);

  return {
    type: 'components',
    subfolder,
    outputPath: componentsOutputDir,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generates a full page based on the components and layout
 */
async function generatePage(subfolder: string, targetFile: string, pageName: string, sfNextDir: string): Promise<GenerateResult> {
  console.log(`Generating page for: ${subfolder}`);

  // Construct paths
  const outputDir = join(process.cwd(), 'output', subfolder);
  const analysisDir = join(outputDir, 'analysis');
  const pageOutputPath = join(sfNextDir, 'src', 'routes', targetFile);
  const templatePath = join(process.cwd(), 'src', 'prompts', 'generate-page.hbs');

  // 1. Read manifest file
  console.log('Reading manifest file...');
  const manifestPath = join(analysisDir, 'manifest.json');
  const manifestContent = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestContent);
  console.log(`✓ Found manifest with ${manifest.components.length} components`);

  // 2. Read technical requirements file
  const technicalRequirementsPath = join(process.cwd(), 'src', 'prompts', 'technical-requirements.md');
  const technicalRequirementsContent = await readFile(technicalRequirementsPath, 'utf-8');
  const technicalRequirements = technicalRequirementsContent.trim();

  // 3. Prepare template context
  const context = {
    manifest: path.resolve(manifestPath),
    htmlSource: path.resolve(manifest.htmlSource),
    screenshot: path.resolve(manifest.screenshot),
    pageName,
    sfNextDir: path.resolve(sfNextDir),
    targetFile,
    technicalRequirements,
  };

  console.log('Template context:');
  console.log(`  - Manifest: ${context.manifest}`);
  console.log(`  - HTML Source: ${context.htmlSource}`);
  console.log(`  - Screenshot: ${context.screenshot}`);
  console.log(`  - Page name: ${pageName}`);
  console.log(`  - Target file: ${targetFile}`);
  console.log(`  - Target directory: ${sfNextDir}`);
  console.log(`  - Components: ${manifest.components.length} (sourceFile paths in manifest)`);

  // 5. Compile Handlebars template
  console.log('\nCompiling Handlebars template...');
  const templateContent = await readFile(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  const prompt = template(context);

  // Write prompt to prompts directory for transparency
  const promptOutputDir = join(outputDir, 'prompts');
  const promptOutputPath = join(promptOutputDir, 'generate-page.md');
  await mkdir(promptOutputDir, { recursive: true });
  await writeFile(promptOutputPath, prompt, 'utf-8');
  console.log(`✓ Wrote page generation prompt to: ${promptOutputPath}`);

  // 6. Call Claude CLI to generate page
  console.log('\n' + '='.repeat(60));
  console.log('Invoking Claude CLI to generate page...');
  console.log('='.repeat(60) + '\n');

  const command = `cat ${promptOutputPath} | claude -p --permission-mode acceptEdits`;

  try {
    execSync(command, {
      encoding: 'utf-8',
      stdio: 'inherit', // Show Claude's output in real-time
    });

    console.log('\n' + '='.repeat(60));
    console.log('Page generation completed!');
    console.log('='.repeat(60));
  } catch (error: any) {
    throw new Error(`Claude CLI failed: ${error.message}`);
  }

  return {
    type: 'page',
    subfolder,
    outputPath: pageOutputPath,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Main generator function that routes to the appropriate generation type
 */
export async function generate(options: GeneratorOptions): Promise<GenerateResult> {
  const { type, subfolder, sfNextDir, targetFile, pageName } = options;

  // Validate subfolder exists
  const outputDir = join(process.cwd(), 'output', subfolder);

  console.log(`\n=== Starting ${type} generation ===`);
  console.log(`Subfolder: ${subfolder}`);
  console.log(`Output directory: ${outputDir}`);
  console.log(`SF Next directory: ${sfNextDir}\n`);
  if (type === 'page') {
    console.log(`Target file: ${targetFile}`);
    console.log(`Page name: ${pageName}`);
  }

  const startTime = Date.now();

  try {
    let result: GenerateResult;

    switch (type) {
      case 'components':
        result = await generateComponents(subfolder, sfNextDir);
        break;
      case 'page':
        if (!targetFile || !pageName) {
          throw new Error('targetFile and pageName are required for page generation');
        }
        result = await generatePage(subfolder, targetFile, pageName, sfNextDir);
        break;
      default:
        throw new Error(`Unknown generation type: ${type}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nCompleted in ${duration}s`);

    return result;
  } catch (error) {
    console.error(`\nError during ${type} generation:`, error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  const type = process.argv[2] as GenerationType;
  const subfolder = process.argv[3];
  const sfNextDir = process.argv[4];
  const targetFile = process.argv[5]; // For page type
  const pageName = process.argv[6];   // For page type

  if (!type || !subfolder || !sfNextDir) {
    console.error('Usage: pnpm generate <type> <subfolder> <sfNextDir> [targetFile] [pageName]');
    console.error('  type: components | page');
    console.error('  subfolder: folder name under output/ (e.g., www-spacenk-com)');
    console.error('  sfNextDir: path to Storefront Next project directory');
    console.error('  targetFile: (required for page) target file path');
    console.error('  pageName: (required for page) name of the page');
    console.error('\nExamples:');
    console.error('  pnpm generate components www-spacenk-com storefront-next');
    console.error('  pnpm generate page www-eataly-com storefront-next src/app/page.tsx HomePage');
    process.exit(1);
  }

  if (type !== 'components' && type !== 'page') {
    console.error(`Error: Invalid type "${type}". Must be "components" or "page"`);
    process.exit(1);
  }

  if (type === 'page' && (!targetFile || !pageName)) {
    console.error('Error: targetFile and pageName are required for page generation');
    console.error('Usage: pnpm generate page <subfolder> <sfNextDir> <targetFile> <pageName>');
    process.exit(1);
  }

  generate({ type, subfolder, sfNextDir, targetFile, pageName })
    .then((result) => {
      console.log('\n✓ Generation completed successfully!');
      console.log('Results:', result);
    })
    .catch((error) => {
      console.error('Generation failed:', error);
      process.exit(1);
    });
}

import { generate } from './generate-content.mjs';
try {
  generate(undefined, true);
  const { loadContent, validateContent, createManifest } = await import('../src/content/index.ts');
  const config = loadContent();
  const errors = validateContent(config);
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(createManifest(config), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

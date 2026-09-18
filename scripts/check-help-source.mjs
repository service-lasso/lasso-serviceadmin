import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'docs/help-source.json'), 'utf8'));
if (manifest.repository !== 'service-lasso/service-lasso' || !/^[0-9a-f]{40}$/.test(manifest.revision)) throw new Error('Invalid canonical documentation identity.');
const expected = new Set(['README.md']);
for (const entry of manifest.files) {
  if (!/^docs\/help\/[a-z0-9-]+\.md$/.test(entry.destination)) throw new Error('Invalid packaged help path.');
  const content = await readFile(path.join(root, entry.destination));
  if (createHash('sha256').update(content).digest('hex') !== entry.sha256) throw new Error(`Packaged help was edited independently: ${entry.destination}. Edit Core and re-export.`);
  expected.add(path.basename(entry.destination));
}
for (const file of await readdir(path.join(root, 'docs/help'))) {
  if (file.endsWith('.md') && !expected.has(file)) throw new Error(`Untracked help article ${file}; author it in Core and add it to the export inventory.`);
}
console.log(`Verified ${manifest.files.length} packaged articles from Core ${manifest.revision}.`);

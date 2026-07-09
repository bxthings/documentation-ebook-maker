/**
 * Integration test: verifies the generated EPUB's OPF spine includes the EPUB3
 * nav document (toc.xhtml) with linear="no".
 *
 * Fails with exit code 1 if the check fails. Intended for `npm run test:epub`.
 */
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { buildEpub } from '../src/epub';

const outputPath = join(tmpdir(), `epub-structure-test-${process.pid}.epub`);

async function run(): Promise<void> {
  const pages = [
    { url: 'https://example.com/docs', title: 'Docs', html: '<p>Hello</p>' },
    { url: 'https://example.com/docs/page', title: 'Page', html: '<p>World</p>' },
  ];

  await buildEpub(pages, { title: 'Test', outputPath, seedUrl: 'https://example.com/docs' });

  const opf = execFileSync('unzip', ['-p', outputPath, 'OEBPS/content.opf'], { encoding: 'utf8' });

  if (!opf.includes('idref="toc"')) {
    console.error('FAIL: toc itemref missing from spine');
    process.exit(1);
  }

  if (!/idref="toc"[^>]*linear="no"/.test(opf)) {
    console.error('FAIL: toc itemref in spine is missing linear="no"');
    console.error('Relevant spine excerpt:');
    const spineStart = opf.indexOf('<spine');
    const spineEnd = opf.indexOf('</spine>') + '</spine>'.length;
    console.error(opf.slice(spineStart, spineEnd));
    process.exit(1);
  }

  console.log('PASS: toc nav document is in spine with linear="no"');
}

run()
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  })
  .finally(() => {
    if (existsSync(outputPath)) unlinkSync(outputPath);
  });

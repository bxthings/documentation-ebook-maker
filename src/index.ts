import { resolve } from 'path';
import { crawl } from './crawler';
import { buildEpub } from './epub';

function parseArgs(argv: string[]): {
  seedUrl: string;
  output: string;
  title: string;
  delay: number;
  maxPages: number;
} {
  const args = argv.slice(2);

  if (args.length === 0 || args[0].startsWith('-')) {
    console.error('Usage: tsx src/index.ts <url> [--output <file.epub>] [--title <title>] [--delay <ms>] [--max-pages <n>]');
    process.exit(1);
  }

  const seedUrl = args[0];
  let output = '';
  let title = '';
  let delay = 500;
  let maxPages = 500;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
        output = args[++i] ?? '';
        break;
      case '--title':
        title = args[++i] ?? '';
        break;
      case '--delay':
        delay = parseInt(args[++i] ?? '500', 10);
        break;
      case '--max-pages':
        maxPages = parseInt(args[++i] ?? '500', 10);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!output) {
    const urlSlug = new URL(seedUrl).pathname.replace(/\//g, '-').replace(/^-|-$/g, '') || 'output';
    output = `${urlSlug}.epub`;
  }

  if (!title) {
    title = new URL(seedUrl).hostname;
  }

  return { seedUrl, output: resolve(output), title, delay, maxPages };
}

async function main(): Promise<void> {
  const { seedUrl, output, title, delay, maxPages } = parseArgs(process.argv);

  console.error(`Crawling: ${seedUrl}`);
  console.error(`Output:   ${output}`);
  console.error(`Title:    ${title}`);
  console.error(`Delay:    ${delay}ms`);
  console.error(`Max pages: ${maxPages}`);
  console.error('');

  const pages = await crawl(seedUrl, { delay, maxPages });

  if (pages.length === 0) {
    console.error('No pages crawled — nothing to write.');
    process.exit(1);
  }

  console.error(`\nCrawled ${pages.length} page(s). Building EPUB...`);
  await buildEpub(pages, { title, outputPath: output, seedUrl });
  console.log(output);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

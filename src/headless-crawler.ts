import { chromium, BrowserContext } from 'playwright';
import { CrawledPage, CrawlOptions, isSubpath, normalizeUrl, extractLinks } from './crawler';
import * as cheerio from 'cheerio';

async function fetchPageHeadless(url: string, context: BrowserContext): Promise<string | null> {
  const page = await context.newPage();
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) {
      process.stderr.write(`  HTTP ${response?.status() ?? '?'} — skipping\n`);
      return null;
    }
    const contentType = response.headers()['content-type'] ?? '';
    if (!contentType.includes('text/html')) {
      process.stderr.write(`  Not HTML (${contentType}) — skipping\n`);
      return null;
    }

    // Wait for React streaming SSR to hydrate: a real content element inside
    // <main> should appear once loading spinners (role="status") are replaced.
    try {
      await page.waitForSelector('main :not([role="status"])', { timeout: 15_000 });
    } catch {
      // Timeout or no <main> — fall back to whatever is rendered now.
    }

    return await page.content();
  } catch (err) {
    process.stderr.write(`  Fetch error: ${(err as Error).message} — skipping\n`);
    return null;
  } finally {
    await page.close();
  }
}

export async function crawlHeadless(
  seedUrl: string,
  options?: CrawlOptions
): Promise<CrawledPage[]> {
  const { delay = 500, maxPages = 500 } = options ?? {};
  const normalizedSeed = normalizeUrl(seedUrl);
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  const queued = new Set<string>([normalizedSeed]);
  const queue: string[] = [normalizedSeed];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'document-extractor/0.1.0',
  });

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      process.stderr.write(`Fetching [${pages.length + 1}/${maxPages}]: ${url}\n`);
      const html = await fetchPageHeadless(url, context);
      if (!html) continue;

      const $ = cheerio.load(html);
      const title =
        $('h1').first().text().trim() ||
        $('title').first().text().trim() ||
        url;

      pages.push({ url, title, html });

      const links = extractLinks($, url);
      for (const link of links) {
        if (!visited.has(link) && !queued.has(link) && isSubpath(normalizedSeed, link)) {
          queue.push(link);
          queued.add(link);
        }
      }

      if (queue.length > 0 && pages.length < maxPages) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (queue.length > 0) {
    process.stderr.write(
      `Warning: hit --max-pages limit (${maxPages}). ${queue.length} pages in the queue were not crawled.\n`
    );
  }

  return pages;
}

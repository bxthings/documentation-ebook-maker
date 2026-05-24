import * as cheerio from 'cheerio';

export interface CrawledPage {
  url: string;
  title: string;
  html: string;
}

export interface CrawlOptions {
  delay?: number;
  maxPages?: number;
}

export function isSubpath(seedUrl: string, candidateUrl: string): boolean {
  const seed = new URL(seedUrl);
  const candidate = new URL(candidateUrl);
  if (seed.origin !== candidate.origin) return false;
  const seedPath = seed.pathname.replace(/\/$/, '');
  const candidatePath = candidate.pathname.replace(/\/$/, '');
  return candidatePath === seedPath || candidatePath.startsWith(seedPath + '/');
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  u.search = '';
  if (u.pathname !== '/' && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/$/, '');
  }
  return u.href;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'document-extractor/0.1.0' },
    });
    if (!response.ok) {
      process.stderr.write(`  HTTP ${response.status} — skipping\n`);
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      process.stderr.write(`  Not HTML (${contentType}) — skipping\n`);
      return null;
    }
    return await response.text();
  } catch (err) {
    process.stderr.write(`  Fetch error: ${(err as Error).message} — skipping\n`);
    return null;
  }
}

function extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links: string[] = [];
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (!['http:', 'https:'].includes(resolved.protocol)) return;
      links.push(normalizeUrl(resolved.href));
    } catch {
      // invalid href — skip
    }
  });
  return links;
}

export async function crawl(seedUrl: string, options?: CrawlOptions): Promise<CrawledPage[]> {
  const { delay = 500, maxPages = 500 } = options ?? {};
  const normalizedSeed = normalizeUrl(seedUrl);
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();
  const queued = new Set<string>([normalizedSeed]);
  const queue: string[] = [normalizedSeed];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    process.stderr.write(`Fetching [${pages.length + 1}/${maxPages}]: ${url}\n`);
    const html = await fetchPage(url);
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

  if (queue.length > 0) {
    process.stderr.write(
      `Warning: hit --max-pages limit (${maxPages}). ${queue.length} pages in the queue were not crawled.\n`
    );
  }

  return pages;
}

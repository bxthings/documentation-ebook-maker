import { CrawledPage } from './crawler';

export function chapterFilename(index: number): string {
  return `chapter-${String(index + 1).padStart(3, '0')}`;
}

export function buildUrlToFilenameMap(pages: CrawledPage[]): Map<string, string> {
  const map = new Map<string, string>();
  pages.forEach((page, i) => {
    const filename = chapterFilename(i);
    map.set(page.url, filename);
    // Add locale-stripped alias (e.g. /en/copilot/... → /copilot/...) so that
    // links without a locale prefix still resolve to the correct chapter.
    try {
      const u = new URL(page.url);
      const stripped = u.pathname.replace(/^\/[a-z]{2}(-[a-z]{2,4})?\//, '/');
      if (stripped !== u.pathname) {
        const alias = new URL(page.url);
        alias.pathname = stripped;
        map.set(alias.href, filename);
      }
    } catch {
      // ignore malformed URLs
    }
  });
  return map;
}

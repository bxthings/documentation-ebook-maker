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

export interface TocNode {
  title: string;
  filename: string;
  children: TocNode[];
}

/**
 * Build a URL-path hierarchy from crawled pages. The seed page becomes the
 * single root node (or a top-level item when grouped with orphaned pages).
 * Pages whose immediate URL parent was not crawled are attached to the nearest
 * crawled ancestor; true orphans surface at the top level.
 *
 * Order follows `pages` (crawl order, i.e. chapter order), not URL depth:
 * a shallow page such as /privacy-policy must not jump ahead of deeper
 * siblings that were crawled first. All nodes are built up front, so a
 * child can be attached to its parent even when the parent is crawled later.
 */
export function buildTocTree(
  pages: CrawledPage[],
  seedUrl: string,
  urlToFilename: Map<string, string>
): TocNode[] {
  const seedPath = new URL(seedUrl).pathname.replace(/\/$/, '');
  const byPath = new Map<string, TocNode>();

  for (const page of pages) {
    const path = new URL(page.url).pathname.replace(/\/$/, '');
    byPath.set(path, {
      title: page.title,
      filename: urlToFilename.get(page.url) ?? '',
      children: [],
    });
  }

  const roots: TocNode[] = [];

  // Iterate in crawl (chapter) order. Parents are looked up in the
  // pre-built map, so no shallower-first sort is needed to wire children up.
  for (const page of pages) {
    const path = new URL(page.url).pathname.replace(/\/$/, '');
    const node = byPath.get(path)!;

    if (path === seedPath) {
      roots.push(node);
      continue;
    }

    let search = path.substring(0, path.lastIndexOf('/'));
    let placed = false;
    while (search.length >= seedPath.length) {
      const parent = byPath.get(search);
      if (parent) {
        parent.children.push(node);
        placed = true;
        break;
      }
      if (search.length === seedPath.length) break;
      search = search.substring(0, search.lastIndexOf('/'));
    }
    if (!placed) roots.push(node);
  }

  return roots;
}

export function renderTocHtml(nodes: TocNode[]): string {
  if (nodes.length === 0) return '';
  const items = nodes
    .map(({ title, filename, children }) => {
      const link = filename ? `<a href="${filename}.xhtml">${title}</a>` : title;
      const nested = renderTocHtml(children);
      return `<li>${link}${nested ? `\n${nested}` : ''}</li>`;
    })
    .join('\n');
  return `<ol>\n${items}\n</ol>`;
}

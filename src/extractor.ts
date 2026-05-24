import * as cheerio from 'cheerio';

const CONTENT_SELECTORS = [
  'main article',
  'main',
  'article',
  '.markdown-body',
  '.content',
  'body',
];

const STRIP_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  'script',
  'style',
  '.sidebar',
  '.toc',
];

export function extractContent(html: string, pageUrl?: string): { title: string; content: string } {
  const $ = cheerio.load(html);

  const title =
    $('h1').first().text().trim() ||
    $('title').first().text().trim() ||
    'Untitled';

  // Collect tool display names from tab nav before stripping it, then inject
  // headings into each tool content section so they survive nav removal.
  const toolLabels = new Map<string, string>();
  $('a[data-tool]').each((_i, el) => {
    const id = $(el).attr('data-tool');
    const label = $(el).text().trim();
    if (id && label) toolLabels.set(id, label);
  });
  if (toolLabels.size > 0) {
    $('div[class*="ghd-tool"]').each((_i, el) => {
      const toolId = ($(el).attr('class') ?? '').split(/\s+/).find((c) => c !== 'ghd-tool');
      if (toolId) {
        const label = toolLabels.get(toolId) ?? toolId;
        $(el).prepend(`<h3>${label}</h3>`);
      }
    });
  }

  // Unwrap self-referential heading anchor links (browser "copy link" affordance).
  // Remove aria-hidden symbol spans first, then replace the <a> with its text.
  $('h1,h2,h3,h4,h5,h6').each((_i, el) => {
    $(el).find('a[href^="#"]').each((_j, anchor) => {
      $(anchor).find('[aria-hidden]').remove();
      $(anchor).replaceWith($(anchor).html() ?? '');
    });
  });

  STRIP_SELECTORS.forEach((sel) => $(sel).remove());

  // Resolve relative image src to absolute so the EPUB library can download them
  if (pageUrl) {
    $('img[src]').each((_i, el) => {
      const src = $(el).attr('src');
      if (src) {
        try {
          $(el).attr('src', new URL(src, pageUrl).href);
        } catch {
          // leave as-is
        }
      }
    });
  }

  let content: string | null = null;
  for (const sel of CONTENT_SELECTORS) {
    const found = $(sel);
    if (found.length > 0) {
      content = $.html(found.first());
      break;
    }
  }
  if (!content) content = $.html('body');
  return { title, content: content ?? '<p>No content extracted.</p>' };
}

export function rewriteLinks(
  html: string,
  urlToFilename: Map<string, string>,
  baseUrl: string
): string {
  const $ = cheerio.load(html, { xmlMode: false });

  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }

    const hash = resolved.hash;
    const urlWithoutHash = resolved.href.replace(/#.*$/, '');
    const filename = urlToFilename.get(urlWithoutHash);

    if (filename) {
      $(el).attr('href', `${filename}.xhtml${hash}`);
    }
  });

  return $('body').html() ?? html;
}

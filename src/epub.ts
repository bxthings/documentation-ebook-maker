import { EPub } from '@lesjoursfr/html-to-epub';
import { CrawledPage } from './crawler';
import { extractContent, rewriteLinks } from './extractor';

export interface EpubOptions {
  title: string;
  outputPath: string;
}

function chapterFilename(index: number): string {
  return `chapter-${String(index + 1).padStart(3, '0')}`;
}

export async function buildEpub(pages: CrawledPage[], options: EpubOptions): Promise<void> {
  const urlToFilename = new Map<string, string>(
    pages.map((page, i) => [page.url, chapterFilename(i)])
  );

  const content = pages.map((page, i) => {
    const { content: extracted } = extractContent(page.html);
    const rewritten = rewriteLinks(extracted, urlToFilename, page.url);
    return {
      title: page.title,
      data: rewritten,
      filename: chapterFilename(i),
    };
  });

  const epub = new EPub(
    {
      title: options.title,
      description: options.title,
      author: 'document-extractor',
      lang: 'en',
      content,
    },
    options.outputPath
  );

  await epub.render();
}

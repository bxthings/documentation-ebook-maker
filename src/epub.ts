import { EPub } from '@lesjoursfr/html-to-epub';
import { CrawledPage } from './crawler';
import { extractContent, rewriteLinks } from './extractor';
import { buildUrlToFilenameMap, chapterFilename } from './url-map';

export { buildUrlToFilenameMap } from './url-map';

export interface EpubOptions {
  title: string;
  outputPath: string;
}

export async function buildEpub(pages: CrawledPage[], options: EpubOptions): Promise<void> {
  const urlToFilename = buildUrlToFilenameMap(pages);

  const content = pages.map((page, i) => {
    const { content: extracted } = extractContent(page.html, page.url);
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

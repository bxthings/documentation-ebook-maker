import { resolve } from 'path';
import { EPub, EpubContentOptions } from '@lesjoursfr/html-to-epub';
import { CrawledPage } from './crawler';
import { extractContent, rewriteLinks } from './extractor';
import { buildUrlToFilenameMap, buildTocTree, renderTocHtml, chapterFilename } from './url-map';

export { buildUrlToFilenameMap } from './url-map';

export interface EpubOptions {
  title: string;
  outputPath: string;
  seedUrl: string;
}

export async function buildEpub(pages: CrawledPage[], options: EpubOptions): Promise<void> {
  const urlToFilename = buildUrlToFilenameMap(pages);
  const tocTree = buildTocTree(pages, options.seedUrl, urlToFilename);

  const content: EpubContentOptions[] = pages.map((page, i) => {
    const { content: extracted } = extractContent(page.html, page.url);
    const rewritten = rewriteLinks(extracted, urlToFilename, page.url);
    return {
      title: page.title,
      data: rewritten,
      filename: chapterFilename(i),
    };
  });

  // Hierarchical TOC page — nested <ol> matching URL path structure.
  // The library's auto-generated toc.xhtml is flat; this readable page restores
  // the tree structure visible in the site sidebar.
  content.unshift({
    title: 'Contents',
    data: `<h1>Contents</h1>\n${renderTocHtml(tocTree)}`,
    filename: 'toc-page',
    beforeToc: true,
  });

  const epub = new EPub(
    {
      title: options.title,
      description: options.title,
      author: 'document-extractor',
      lang: 'en',
      appendChapterTitles: false,
      hideToC: true,
      customOpfTemplatePath: resolve(__dirname, '..', 'templates', 'content.opf.ejs'),
      content,
    },
    options.outputPath
  );

  await epub.render();
}

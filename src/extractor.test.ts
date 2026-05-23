import { rewriteLinks } from './extractor';

describe('rewriteLinks', () => {
  const baseUrl = 'https://docs.example.com/en/copilot';
  const urlToFilename = new Map([
    ['https://docs.example.com/en/copilot', 'chapter-001'],
    ['https://docs.example.com/en/copilot/overview', 'chapter-002'],
    ['https://docs.example.com/en/copilot/getting-started', 'chapter-003'],
  ]);

  it('rewrites an absolute href that is in the map', () => {
    const html = '<a href="https://docs.example.com/en/copilot/overview">Overview</a>';
    const result = rewriteLinks(html, urlToFilename, baseUrl);
    expect(result).toContain('href="chapter-002.xhtml"');
  });

  it('rewrites a root-relative href by resolving against baseUrl origin first', () => {
    const html = '<a href="/en/copilot/overview">Overview</a>';
    const result = rewriteLinks(html, urlToFilename, baseUrl);
    expect(result).toContain('href="chapter-002.xhtml"');
  });

  it('preserves hash fragment when rewriting', () => {
    const html = '<a href="https://docs.example.com/en/copilot/overview#section-1">Sec</a>';
    const result = rewriteLinks(html, urlToFilename, baseUrl);
    expect(result).toContain('href="chapter-002.xhtml#section-1"');
  });

  it('leaves an href that is not in the map unchanged', () => {
    const html = '<a href="https://external.com/page">External</a>';
    const result = rewriteLinks(html, urlToFilename, baseUrl);
    expect(result).toContain('href="https://external.com/page"');
  });

  it('leaves mailto links unchanged', () => {
    const html = '<a href="mailto:user@example.com">Email</a>';
    const result = rewriteLinks(html, urlToFilename, baseUrl);
    expect(result).toContain('href="mailto:user@example.com"');
  });

  it('does not alter non-anchor elements', () => {
    const html = '<img src="https://docs.example.com/en/copilot/image.png">';
    const result = rewriteLinks(html, urlToFilename, baseUrl);
    expect(result).toContain('src="https://docs.example.com/en/copilot/image.png"');
  });
});

import { extractContent, rewriteLinks } from './extractor';

describe('extractContent', () => {
  it('adds headings to ghd-tool sections using nav label text', () => {
    const html = `<html><body>
      <nav>
        <a data-tool="vscode">Visual Studio Code</a>
        <a data-tool="webui">Web browser</a>
      </nav>
      <main>
        <div class="ghd-tool vscode"><p>VS Code content</p></div>
        <div class="ghd-tool webui"><p>Web browser content</p></div>
      </main>
    </body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain('<h3>Visual Studio Code</h3>');
    expect(content).toContain('<h3>Web browser</h3>');
    expect(content).toContain('VS Code content');
    expect(content).toContain('Web browser content');
  });

  it('does not add headings when no ghd-tool sections are present', () => {
    const html = `<html><body><main><p>Plain content</p></main></body></html>`;
    const { content } = extractContent(html);
    expect(content).not.toContain('<h3>');
    expect(content).toContain('Plain content');
  });
});

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

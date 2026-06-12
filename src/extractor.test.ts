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

  it('unwraps self-referential heading anchor links and removes symbol spans', () => {
    const html = `<html><body><main>
      <h2 id="intro" tabindex="-1">
        <a class="heading-link" href="#intro">Introduction<span class="heading-link-symbol" aria-hidden="true"></span></a>
      </h2>
      <h3 id="sub" tabindex="-1">
        <a class="heading-link" href="#sub">Subsection<span aria-hidden="true">¶</span></a>
      </h3>
    </main></body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain('Introduction');
    expect(content).toContain('Subsection');
    expect(content).not.toContain('href="#intro"');
    expect(content).not.toContain('href="#sub"');
    expect(content).not.toContain('heading-link-symbol');
  });

  it('does not add headings when no ghd-tool sections are present', () => {
    const html = `<html><body><main><p>Plain content</p></main></body></html>`;
    const { content } = extractContent(html);
    expect(content).not.toContain('<h3>');
    expect(content).toContain('Plain content');
  });

  it('converts card-style links to linked heading, plain body, and hr separator', () => {
    const html = `<html><body><main>
      <a href="/article-1">
        <span>Tag A</span>
        <h3>First Article</h3>
        <p>Description one.</p>
      </a>
      <a href="/article-2">
        <span>Tag B</span>
        <h3>Second Article</h3>
        <p>Description two.</p>
      </a>
    </main></body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain('<h3><a href="/article-1">First Article</a></h3>');
    expect(content).toContain('<h3><a href="/article-2">Second Article</a></h3>');
    expect(content).toContain('Description one');
    expect(content).toContain('Description two');
    // exactly one hr between the two cards, none before the first
    expect(content.match(/<hr/g)?.length).toBe(1);
  });

  it('does not convert a simple inline link that does not wrap a heading', () => {
    const html = `<html><body><main><p><a href="/x">simple link</a></p><h3>A heading</h3></main></body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain('<a href="/x">simple link</a>');
    expect(content).not.toContain('<hr');
  });

  it('strips elements with the hidden attribute (invisible UI chrome, invalid XHTML)', () => {
    const html = `<html><body><main>
      <article>
        <p>Visible before.</p>
        <div hidden role="region"><p>Accordion panel content.</p></div>
        <p>Visible after.</p>
      </article>
    </main></body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain('Visible before');
    expect(content).toContain('Visible after');
    expect(content).not.toContain('Accordion panel content');
  });

  it('extracts breadcrumb links before nav is stripped and prepends them to content', () => {
    const html = `<html><body>
      <nav aria-label="Breadcrumb">
        <ul>
          <li><a href="/en/copilot">GitHub Copilot</a></li>
          <li><a href="/en/copilot/concepts">Concepts</a></li>
          <li><a href="/en/copilot/concepts/agents">Agents</a></li>
        </ul>
      </nav>
      <main><h1>About Agents</h1><p>Body text.</p></main>
    </body></html>`;
    const { content } = extractContent(html);
    // Breadcrumb links should appear in output (nav itself is stripped, links rescued first)
    expect(content).toContain('<a href="/en/copilot">GitHub Copilot</a>');
    expect(content).toContain('<a href="/en/copilot/concepts">Concepts</a>');
    // Breadcrumb should be before the main content
    expect(content.indexOf('GitHub Copilot')).toBeLessThan(content.indexOf('Body text'));
  });

  it('picks the richest article when a loading-spinner placeholder article precedes real content', () => {
    // Simulates Next.js streaming SSR: one article in <main> has loading placeholder text,
    // the real content article lives in a hidden SSR div elsewhere in the document.
    const html = `<html><body>
      <main><article><span>Loading...</span><span>Loading...</span></article></main>
      <div id="S:1">
        <article><h1>Real Content</h1><p>${'Actual documentation text. '.repeat(30)}</p></article>
      </div>
    </body></html>`;
    const { title, content } = extractContent(html);
    expect(title).toBe('Real Content');
    expect(content).toContain('Actual documentation text');
    expect(content).not.toMatch(/^Loading/);
  });

  it('omits breadcrumb when no Breadcrumb nav is present', () => {
    const html = `<html><body><main><h1>Page</h1><p>Text.</p></main></body></html>`;
    const { content } = extractContent(html);
    expect(content).toContain('Text.');
    // No stray breadcrumb paragraph
    expect(content).not.toMatch(/<p>[^<]*\/[^<]*<\/p>/);
  });

  it('inserts space between adjacent inline sibling elements with no whitespace', () => {
    const html = `<html><body><main>
      <a href="/article">
        <span class="prc-Token-TokenBase">AI</span><span class="prc-Token-TokenBase">Machine Learning</span>
      </a>
      <p><span>foo</span><em>bar</em><code>baz</code></p>
    </main></body></html>`;
    const { content } = extractContent(html);
    // A space must appear between adjacent inline closing/opening tags in the HTML
    // so that EPUB readers (which have no CSS margin) don't concatenate the text.
    expect(content).toContain('</span> <span');
    expect(content).not.toContain('</span><span');
    expect(content).toContain('</span> <em>');
    expect(content).not.toContain('</span><em>');
    expect(content).toContain('</em> <code>');
    expect(content).not.toContain('</em><code>');
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

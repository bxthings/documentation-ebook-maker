import { buildUrlToFilenameMap, buildTocTree, renderTocHtml } from './url-map';

const fakePage = (url: string, title = 'T') => ({ url, title, html: '' });

describe('buildUrlToFilenameMap', () => {
  it('maps crawled URL to chapter filename', () => {
    const map = buildUrlToFilenameMap([fakePage('https://docs.github.com/en/copilot')]);
    expect(map.get('https://docs.github.com/en/copilot')).toBe('chapter-001');
  });

  it('also maps locale-stripped URL to the same chapter', () => {
    const map = buildUrlToFilenameMap([
      fakePage('https://docs.github.com/en/copilot/get-started/what-is-github-copilot'),
    ]);
    expect(map.get('https://docs.github.com/en/copilot/get-started/what-is-github-copilot')).toBe('chapter-001');
    expect(map.get('https://docs.github.com/copilot/get-started/what-is-github-copilot')).toBe('chapter-001');
  });

  it('does not add alias when URL has no locale prefix', () => {
    const map = buildUrlToFilenameMap([fakePage('https://example.com/docs/page')]);
    expect(map.size).toBe(1);
  });

  it('numbers chapters sequentially', () => {
    const map = buildUrlToFilenameMap([
      fakePage('https://docs.github.com/en/copilot'),
      fakePage('https://docs.github.com/en/copilot/overview'),
    ]);
    expect(map.get('https://docs.github.com/en/copilot')).toBe('chapter-001');
    expect(map.get('https://docs.github.com/en/copilot/overview')).toBe('chapter-002');
  });
});

describe('buildTocTree', () => {
  const seed = 'https://docs.example.com/en/copilot';

  it('places the seed page as the single root node', () => {
    const pages = [fakePage(seed, 'Root')];
    const map = buildUrlToFilenameMap(pages);
    const tree = buildTocTree(pages, seed, map);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Root');
    expect(tree[0].children).toHaveLength(0);
  });

  it('nests direct children under the seed node', () => {
    const pages = [
      fakePage(seed, 'Root'),
      fakePage(`${seed}/overview`, 'Overview'),
      fakePage(`${seed}/quickstart`, 'Quickstart'),
    ];
    const map = buildUrlToFilenameMap(pages);
    const tree = buildTocTree(pages, seed, map);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children.map((c) => c.title)).toEqual(['Overview', 'Quickstart']);
  });

  it('nests grandchildren under their parent node', () => {
    const pages = [
      fakePage(seed, 'Root'),
      fakePage(`${seed}/concepts`, 'Concepts'),
      fakePage(`${seed}/concepts/agents`, 'Agents'),
    ];
    const map = buildUrlToFilenameMap(pages);
    const tree = buildTocTree(pages, seed, map);
    const concepts = tree[0].children[0];
    expect(concepts.title).toBe('Concepts');
    expect(concepts.children[0].title).toBe('Agents');
  });

  it('attaches orphaned pages to nearest crawled ancestor', () => {
    // /concepts is not crawled; /concepts/agents should attach to seed
    const pages = [
      fakePage(seed, 'Root'),
      fakePage(`${seed}/concepts/agents`, 'Agents'),
    ];
    const map = buildUrlToFilenameMap(pages);
    const tree = buildTocTree(pages, seed, map);
    expect(tree[0].children[0].title).toBe('Agents');
  });
});

describe('renderTocHtml', () => {
  it('returns empty string for empty node list', () => {
    expect(renderTocHtml([])).toBe('');
  });

  it('renders a flat list of nodes as <ol><li> elements', () => {
    const nodes = [
      { title: 'A', filename: 'chapter-001', children: [] },
      { title: 'B', filename: 'chapter-002', children: [] },
    ];
    const html = renderTocHtml(nodes);
    expect(html).toContain('<a href="chapter-001.xhtml">A</a>');
    expect(html).toContain('<a href="chapter-002.xhtml">B</a>');
    expect(html).toMatch(/^<ol>/);
  });

  it('renders nested children inside the parent <li>', () => {
    const nodes = [
      {
        title: 'Parent',
        filename: 'chapter-001',
        children: [{ title: 'Child', filename: 'chapter-002', children: [] }],
      },
    ];
    const html = renderTocHtml(nodes);
    expect(html).toContain('<a href="chapter-001.xhtml">Parent</a>');
    expect(html).toContain('<a href="chapter-002.xhtml">Child</a>');
    // Child <ol> must appear inside the parent <li>
    const parentLiStart = html.indexOf('<li>');
    const childOlStart = html.indexOf('<ol>', parentLiStart + 1);
    const parentLiEnd = html.lastIndexOf('</li>');
    expect(childOlStart).toBeGreaterThan(parentLiStart);
    expect(childOlStart).toBeLessThan(parentLiEnd);
  });
});

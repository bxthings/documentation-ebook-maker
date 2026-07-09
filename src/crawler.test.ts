import { isSubpath, normalizeUrl, extractLinks } from './crawler';
import * as cheerio from 'cheerio';

describe('isSubpath', () => {
  it('returns true for exact match', () => {
    expect(isSubpath('https://example.com/docs', 'https://example.com/docs')).toBe(true);
  });

  it('returns true for a direct child path', () => {
    expect(isSubpath('https://example.com/docs', 'https://example.com/docs/overview')).toBe(true);
  });

  it('returns true for a deeply nested child path', () => {
    expect(
      isSubpath('https://example.com/en/copilot', 'https://example.com/en/copilot/getting-started/about')
    ).toBe(true);
  });

  it('returns false for a sibling path', () => {
    expect(isSubpath('https://example.com/en/copilot', 'https://example.com/en/actions')).toBe(false);
  });

  it('returns false for a path that is a prefix collision (not a real subpath)', () => {
    expect(isSubpath('https://example.com/en/copilot', 'https://example.com/en/copilot-extras')).toBe(false);
  });

  it('returns false for a different origin', () => {
    expect(isSubpath('https://example.com/docs', 'https://other.com/docs')).toBe(false);
  });

  it('handles trailing slash on seed URL', () => {
    expect(isSubpath('https://example.com/docs/', 'https://example.com/docs/overview')).toBe(true);
  });

  it('handles trailing slash on candidate URL', () => {
    expect(isSubpath('https://example.com/docs', 'https://example.com/docs/')).toBe(true);
  });
});

describe('normalizeUrl', () => {
  it('strips hash fragment', () => {
    expect(normalizeUrl('https://example.com/docs#section')).toBe('https://example.com/docs');
  });

  it('strips query string', () => {
    expect(normalizeUrl('https://example.com/docs?q=foo')).toBe('https://example.com/docs');
  });

  it('strips trailing slash from non-root path', () => {
    expect(normalizeUrl('https://example.com/docs/')).toBe('https://example.com/docs');
  });

  it('preserves root path', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('leaves clean URLs unchanged', () => {
    expect(normalizeUrl('https://example.com/docs/overview')).toBe('https://example.com/docs/overview');
  });
});

describe('extractLinks', () => {
  it('returns absolute URLs from anchor hrefs', () => {
    const $ = cheerio.load('<a href="https://example.com/page">link</a>');
    const links = extractLinks($, 'https://example.com/');
    expect(links).toContain('https://example.com/page');
  });

  it('resolves relative hrefs against the base URL', () => {
    const $ = cheerio.load('<a href="/about">About</a>');
    const links = extractLinks($, 'https://example.com/docs');
    expect(links).toContain('https://example.com/about');
  });

  it('strips hashes and query strings from extracted URLs', () => {
    const $ = cheerio.load('<a href="/page?q=1#anchor">link</a>');
    const links = extractLinks($, 'https://example.com/');
    expect(links).toContain('https://example.com/page');
    expect(links).not.toContain(expect.stringContaining('#'));
    expect(links).not.toContain(expect.stringContaining('?'));
  });

  it('skips non-http(s) protocols', () => {
    const $ = cheerio.load('<a href="mailto:foo@example.com">mail</a><a href="ftp://example.com/file">ftp</a>');
    const links = extractLinks($, 'https://example.com/');
    expect(links).toHaveLength(0);
  });

  it('skips anchors without href', () => {
    const $ = cheerio.load('<a>no href</a>');
    const links = extractLinks($, 'https://example.com/');
    expect(links).toHaveLength(0);
  });

  it('returns deduplicated-by-normalization URLs', () => {
    const $ = cheerio.load('<a href="/page/">with slash</a><a href="/page">without slash</a>');
    const links = extractLinks($, 'https://example.com/');
    // Both normalize to the same URL — both appear since dedup is the caller's responsibility
    expect(links.every((l: string) => l === 'https://example.com/page')).toBe(true);
  });
});

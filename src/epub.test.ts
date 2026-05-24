import { buildUrlToFilenameMap } from './url-map';

const fakePage = (url: string) => ({ url, title: 'T', html: '' });

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

import { isSubpath } from './crawler';

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

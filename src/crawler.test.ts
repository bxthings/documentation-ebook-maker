import { isSubpath } from './crawler';

describe('isSubpath', () => {
  it('returns true for exact match', () => {
    expect(isSubpath('https://example.com/docs', 'https://example.com/docs')).toBe(true);
  });
});

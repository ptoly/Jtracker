import { describe, expect, it } from 'vitest';
import { pageItems } from './pagination';

describe('pageItems', () => {
  it('lists every page up to seven', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps the start together near the start', () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
  });

  it('keeps the end together near the end', () => {
    expect(pageItems(7, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
    expect(pageItems(10, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
  });

  it('shows the current page and its neighbours in the middle', () => {
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseStorageOptions } from './storageOptions';

describe('parseStorageOptions', () => {
  it('offers everything when unset', () => {
    expect([...parseStorageOptions(undefined, true)]).toEqual(['demo', 'csv', 'google']);
    expect([...parseStorageOptions('  ', true)]).toEqual(['demo', 'csv', 'google']);
  });

  it('offers only what is listed, ignoring case, spaces and unknown names', () => {
    expect([...parseStorageOptions('demo, CSV,sheets', true)]).toEqual(['demo', 'csv']);
  });

  it('leaves Google out without its settings', () => {
    expect([...parseStorageOptions('demo,csv,google', false)]).toEqual(['demo', 'csv']);
    expect([...parseStorageOptions('google', false)]).toEqual(['demo']);
  });
});

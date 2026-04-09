import { describe, it, expect } from 'vitest';
import {
  isBrowser,
  hasWorkerSupport,
  hasOffscreenCanvas,
  hasCreateImageBitmap,
  hasIndexedDB,
  hasFetch,
  assertBrowser,
} from '../../src/utils/ssr';

describe('SSR guards', () => {
  it('isBrowser returns true in jsdom', () => {
    expect(isBrowser()).toBe(true);
  });

  it('hasWorkerSupport returns true when Worker is defined', () => {
    // jsdom defines Worker
    expect(typeof hasWorkerSupport()).toBe('boolean');
  });

  it('hasOffscreenCanvas returns boolean', () => {
    expect(typeof hasOffscreenCanvas()).toBe('boolean');
  });

  it('hasCreateImageBitmap returns boolean', () => {
    expect(typeof hasCreateImageBitmap()).toBe('boolean');
  });

  it('hasIndexedDB returns boolean', () => {
    expect(typeof hasIndexedDB()).toBe('boolean');
  });

  it('hasFetch returns true (vitest provides fetch)', () => {
    expect(hasFetch()).toBe(true);
  });

  it('assertBrowser does not throw in jsdom', () => {
    expect(() => assertBrowser('test')).not.toThrow();
  });
});

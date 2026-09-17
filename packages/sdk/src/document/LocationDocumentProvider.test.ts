/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocationDocumentProvider } from './LocationDocumentProvider.ts';

// Note: the `typeof location === 'undefined'` branch has no test. These specs
// run in a real browser, where `location` is [LegacyUnforgeable] and therefore
// cannot be replaced with `vi.stubGlobal`.
describe('LocationDocumentProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the current document URL', () => {
    const provider = new LocationDocumentProvider();
    expect(provider.getDocumentUrl()).toBe(location.href);
  });

  it('returns an absolute, parseable URL', () => {
    const provider = new LocationDocumentProvider();

    const url = provider.getDocumentUrl();

    expect(url).not.toBeNull();
    expect(URL.parse(url as string)).not.toBeNull();
  });

  it('reflects the URL after a soft navigation', () => {
    const provider = new LocationDocumentProvider();
    const originalUrl = location.href;

    try {
      history.pushState(
        {},
        '',
        `${location.pathname}${location.search}#checkout`,
      );

      expect(provider.getDocumentUrl()).toBe(location.href);
      expect(provider.getDocumentUrl()).toContain('#checkout');
    } finally {
      history.replaceState({}, '', originalUrl);
    }
  });

  it('applies the sanitizeUrl hook', () => {
    const provider = new LocationDocumentProvider({
      sanitizeUrl: () => 'https://example.com/redacted',
    });

    expect(provider.getDocumentUrl()).toBe('https://example.com/redacted');
  });

  it('supports trimming the query string and hash off the URL', () => {
    // Long URLs with query parameters may be out of scope for the document
    // URL attribute; the hook is how a user keeps its cardinality down.
    const provider = new LocationDocumentProvider({
      sanitizeUrl: (url) => {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      },
    });
    const originalUrl = location.href;

    try {
      // Keep the params the test runner relies on, and add one of our own.
      const params = new URLSearchParams(location.search);
      params.set('token', 'secret');
      history.pushState(
        {},
        '',
        `${location.pathname}?${params.toString()}#section`,
      );

      expect(provider.getDocumentUrl()).toBe(
        `${location.origin}${location.pathname}`,
      );
      expect(provider.getDocumentUrl()).not.toContain('token=secret');
      expect(provider.getDocumentUrl()).not.toContain('#section');
    } finally {
      history.replaceState({}, '', originalUrl);
    }
  });

  it('passes the current document URL to the sanitizeUrl hook', () => {
    const sanitizeUrl = vi.fn((url: string) => url);
    const provider = new LocationDocumentProvider({ sanitizeUrl });

    provider.getDocumentUrl();

    expect(sanitizeUrl).toHaveBeenCalledOnce();
    expect(sanitizeUrl).toHaveBeenCalledWith(location.href);
  });

  it('reads the URL on every call instead of caching it', () => {
    const sanitizeUrl = vi.fn((url: string) => url);
    const provider = new LocationDocumentProvider({ sanitizeUrl });

    provider.getDocumentUrl();
    provider.getDocumentUrl();

    expect(sanitizeUrl).toHaveBeenCalledTimes(2);
  });

  it('returns null and reports the error when sanitizeUrl throws', () => {
    const diagErrorSpy = vi.spyOn(diag, 'error').mockImplementation(() => {});
    const error = new Error('sanitizer blew up');
    const provider = new LocationDocumentProvider({
      sanitizeUrl: () => {
        throw error;
      },
    });

    expect(provider.getDocumentUrl()).toBeNull();
    expect(diagErrorSpy).toHaveBeenCalledWith('sanitizeUrl hook failed', error);
  });
});

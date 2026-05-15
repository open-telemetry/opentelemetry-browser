/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { parseUrl } from './parseUrl.ts';

describe('parseUrl', () => {
  it('returns a URL object for an absolute URL', () => {
    const result = parseUrl('http://example.com/path?q=1');
    expect(result).toBeInstanceOf(URL);
    expect(result.hostname).toBe('example.com');
    expect(result.pathname).toBe('/path');
    expect(result.search).toBe('?q=1');
  });

  it('resolves a relative URL against document.baseURI', () => {
    const result = parseUrl('/api/data');
    expect(result.hostname).toBe('localhost');
    expect(result.pathname).toBe('/api/data');
  });

  it('preserves the origin for an absolute URL', () => {
    const result = parseUrl('https://api.example.com/v2/users');
    expect(result.origin).toBe('https://api.example.com');
  });

  it('returns the full href for an absolute URL', () => {
    const url = 'http://example.com/path';
    expect(parseUrl(url).href).toBe(url);
  });
});

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { urlMatches } from './urlMatches.ts';

describe('urlMatches', () => {
  it('returns true for an exact string match', () => {
    expect(urlMatches('http://example.com/api', 'http://example.com/api')).toBe(
      true,
    );
  });

  it('returns false for a non-matching string', () => {
    expect(
      urlMatches('http://example.com/api', 'http://example.com/other'),
    ).toBe(false);
  });

  it('returns true when the regexp matches', () => {
    expect(urlMatches('http://example.com/api/v1', /\/api\//)).toBe(true);
  });

  it('returns false when the regexp does not match', () => {
    expect(urlMatches('http://example.com/health', /\/api\//)).toBe(false);
  });

  it('handles a regexp with anchors', () => {
    expect(
      urlMatches('http://example.com/api', /^http:\/\/example\.com\/api$/),
    ).toBe(true);
    expect(
      urlMatches('http://example.com/api/v1', /^http:\/\/example\.com\/api$/),
    ).toBe(false);
  });
});

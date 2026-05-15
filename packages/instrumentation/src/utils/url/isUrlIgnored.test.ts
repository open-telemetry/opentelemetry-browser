/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { isUrlIgnored } from './isUrlIgnored.ts';

describe('isUrlIgnored', () => {
  it('returns false when ignoreUrls is undefined', () => {
    expect(isUrlIgnored('http://example.com/api')).toBe(false);
  });

  it('returns false when ignoreUrls is empty', () => {
    expect(isUrlIgnored('http://example.com/api', [])).toBe(false);
  });

  it('returns true for an exact string match', () => {
    expect(
      isUrlIgnored('http://example.com/health', ['http://example.com/health']),
    ).toBe(true);
  });

  it('returns false for a non-matching string', () => {
    expect(
      isUrlIgnored('http://example.com/api', ['http://example.com/health']),
    ).toBe(false);
  });

  it('returns true when a regexp matches', () => {
    expect(isUrlIgnored('http://example.com/health/check', [/\/health/])).toBe(
      true,
    );
  });

  it('returns false when no regexp matches', () => {
    expect(isUrlIgnored('http://example.com/api', [/\/health/])).toBe(false);
  });

  it('matches against any entry in a mixed list', () => {
    const ignoreUrls = ['http://example.com/metrics', /\/health/];
    expect(isUrlIgnored('http://example.com/metrics', ignoreUrls)).toBe(true);
    expect(isUrlIgnored('http://example.com/health', ignoreUrls)).toBe(true);
    expect(isUrlIgnored('http://example.com/api', ignoreUrls)).toBe(false);
  });
});

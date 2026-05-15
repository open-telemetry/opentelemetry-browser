/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { shouldPropagateTraceHeaders } from './shouldPropagateTraceHeaders.ts';

describe('shouldPropagateTraceHeaders', () => {
  // jsdom URL is http://localhost/, so same-origin is http://localhost
  it('returns true for a same-origin URL', () => {
    expect(shouldPropagateTraceHeaders('http://localhost/api')).toBe(true);
  });

  it('returns false for a cross-origin URL with no allowlist', () => {
    expect(shouldPropagateTraceHeaders('https://api.example.com/data')).toBe(
      false,
    );
  });

  it('returns false for a cross-origin URL not in the allowlist', () => {
    expect(
      shouldPropagateTraceHeaders('https://other.example.com/api', [
        'https://allowed.example.com',
      ]),
    ).toBe(false);
  });

  it('returns true for a cross-origin URL matching a string in the allowlist', () => {
    expect(
      shouldPropagateTraceHeaders('https://api.example.com/data', [
        'https://api.example.com/data',
      ]),
    ).toBe(true);
  });

  it('returns true for a cross-origin URL matching a regexp in the allowlist', () => {
    expect(
      shouldPropagateTraceHeaders('https://api.example.com/data', [
        /api\.example\.com/,
      ]),
    ).toBe(true);
  });

  it('accepts a single string (not wrapped in an array)', () => {
    expect(
      shouldPropagateTraceHeaders(
        'https://api.example.com/data',
        'https://api.example.com/data',
      ),
    ).toBe(true);
  });

  it('accepts a single RegExp (not wrapped in an array)', () => {
    expect(
      shouldPropagateTraceHeaders(
        'https://api.example.com/data',
        /api\.example\.com/,
      ),
    ).toBe(true);
  });
});

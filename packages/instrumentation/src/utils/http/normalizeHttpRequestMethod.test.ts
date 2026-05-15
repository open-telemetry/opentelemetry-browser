/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { normalizeHttpRequestMethod } from './normalizeHttpRequestMethod.ts';

const KNOWN_METHODS = [
  'CONNECT',
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT',
  'QUERY',
  'TRACE',
];

describe('normalizeHttpRequestMethod', () => {
  it.each(
    KNOWN_METHODS,
  )('returns %s uppercased for a known method', (method) => {
    expect(normalizeHttpRequestMethod(method)).toBe(method);
  });

  it.each(
    KNOWN_METHODS,
  )('accepts lowercase and returns uppercase for %s', (method) => {
    expect(normalizeHttpRequestMethod(method.toLowerCase())).toBe(method);
  });

  it('returns _OTHER for an unknown method', () => {
    expect(normalizeHttpRequestMethod('BREW')).toBe('_OTHER');
    expect(normalizeHttpRequestMethod('CUSTOM')).toBe('_OTHER');
  });

  it('handles mixed-case input for known methods', () => {
    expect(normalizeHttpRequestMethod('Get')).toBe('GET');
    expect(normalizeHttpRequestMethod('pAtCh')).toBe('PATCH');
  });
});

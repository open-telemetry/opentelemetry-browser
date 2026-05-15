/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { serverPortFromUrl } from './serverPortFromUrl.ts';

describe('serverPortFromUrl', () => {
  it('returns the explicit port when set', () => {
    expect(serverPortFromUrl(new URL('http://example.com:8080/api'))).toBe(
      8080,
    );
  });

  it('returns 443 for https with no explicit port', () => {
    expect(serverPortFromUrl(new URL('https://example.com/api'))).toBe(443);
  });

  it('returns 80 for http with no explicit port', () => {
    expect(serverPortFromUrl(new URL('http://example.com/api'))).toBe(80);
  });

  it('returns undefined for an unknown protocol with no explicit port', () => {
    expect(
      serverPortFromUrl(new URL('ftp://example.com/file')),
    ).toBeUndefined();
  });

  it('returns explicit port over protocol default', () => {
    expect(serverPortFromUrl(new URL('https://example.com:9443/api'))).toBe(
      9443,
    );
  });
});

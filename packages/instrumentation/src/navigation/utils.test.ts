/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { defaultSanitizeUrl, isHashChange } from './utils.ts';

describe('isHashChange', () => {
  it('should return true when adding a hash to the same URL', () => {
    expect(
      isHashChange('https://example.com/page', 'https://example.com/page#s1'),
    ).toBe(true);
  });

  it('should return true when changing hash on the same URL', () => {
    expect(
      isHashChange(
        'https://example.com/page#s1',
        'https://example.com/page#s2',
      ),
    ).toBe(true);
  });

  it('should return false when removing a hash', () => {
    expect(
      isHashChange('https://example.com/page#s1', 'https://example.com/page'),
    ).toBe(false);
  });

  it('should return false when URLs have different paths', () => {
    expect(
      isHashChange(
        'https://example.com/page1#s1',
        'https://example.com/page2#s1',
      ),
    ).toBe(false);
  });

  it('should return false when URLs have different origins', () => {
    expect(
      isHashChange('https://example.com/page#s1', 'https://other.com/page#s2'),
    ).toBe(false);
  });

  it('should return false when URLs have different query parameters', () => {
    expect(
      isHashChange(
        'https://example.com/page?p=1#s1',
        'https://example.com/page?p=2#s2',
      ),
    ).toBe(false);
  });

  it('should return true when only hash differs with same query parameters', () => {
    expect(
      isHashChange(
        'https://example.com/page?p=1#s1',
        'https://example.com/page?p=1#s2',
      ),
    ).toBe(true);
  });

  it('should return true when adding hash with query parameters', () => {
    expect(
      isHashChange(
        'https://example.com/page?p=1',
        'https://example.com/page?p=1#s1',
      ),
    ).toBe(true);
  });

  it('should return false when URLs are identical', () => {
    expect(
      isHashChange(
        'https://example.com/page#s1',
        'https://example.com/page#s1',
      ),
    ).toBe(false);
  });

  it('should return false when both URLs have no hash', () => {
    expect(
      isHashChange('https://example.com/page', 'https://example.com/page'),
    ).toBe(false);
  });

  describe('fallback behavior with invalid URLs', () => {
    it('should handle malformed URLs in fallback mode', () => {
      expect(isHashChange('not-a-valid-url', 'not-a-valid-url#s1')).toBe(true);
    });

    it('should return false in fallback mode when removing hash', () => {
      expect(isHashChange('invalid-url#s1', 'invalid-url')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty hash correctly', () => {
      expect(
        isHashChange(
          'https://example.com/page#',
          'https://example.com/page#s1',
        ),
      ).toBe(true);
    });

    it('should handle URLs with ports', () => {
      expect(
        isHashChange(
          'https://example.com:8080/page',
          'https://example.com:8080/page#s1',
        ),
      ).toBe(true);
    });

    it('should handle URLs with different ports as different origins', () => {
      expect(
        isHashChange(
          'https://example.com:8080/page#s1',
          'https://example.com:9090/page#s2',
        ),
      ).toBe(false);
    });

    it('should handle complex query parameters', () => {
      expect(
        isHashChange(
          'https://example.com/page?a=1&b=2&c=3',
          'https://example.com/page?a=1&b=2&c=3#s1',
        ),
      ).toBe(true);
    });
  });
});

describe('defaultSanitizeUrl', () => {
  it('should redact username and password from URL', () => {
    expect(defaultSanitizeUrl('https://user:pass@example.com/path')).toBe(
      'https://REDACTED:REDACTED@example.com/path',
    );
  });

  it('should redact sensitive query parameters', () => {
    const sanitized = defaultSanitizeUrl(
      'https://example.com/path?api_key=secret123&normal=value',
    );
    expect(sanitized).toContain('api_key=REDACTED');
    expect(sanitized).toContain('normal=value');
  });

  it('should handle multiple sensitive parameters', () => {
    const sanitized = defaultSanitizeUrl(
      'https://example.com/path?token=abc123&password=secret&normal=value',
    );
    expect(sanitized).toContain('token=REDACTED');
    expect(sanitized).toContain('password=REDACTED');
    expect(sanitized).toContain('normal=value');
  });

  it('should preserve fragment/hash in URL', () => {
    const sanitized = defaultSanitizeUrl(
      'https://example.com/path?api_key=secret#section1',
    );
    expect(sanitized).toContain('#section1');
    expect(sanitized).toContain('api_key=REDACTED');
  });

  it('should handle invalid URLs with fallback logic', () => {
    const sanitized = defaultSanitizeUrl(
      'invalid://user:pass@example.com/path?api_key=secret123',
    );
    expect(sanitized).toContain('REDACTED:REDACTED');
    expect(sanitized).toContain('api_key=REDACTED');
  });

  it('should return URL unchanged if no sensitive data', () => {
    const url = 'https://example.com/path?normal=value&other=data';
    expect(defaultSanitizeUrl(url)).toBe(url);
  });

  it('should handle URL encoded sensitive parameters', () => {
    const sanitized = defaultSanitizeUrl(
      'https://example.com/path?api%5Fkey=secret123',
    );
    expect(sanitized).toContain('REDACTED');
  });
});

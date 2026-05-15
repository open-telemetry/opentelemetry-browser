/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { getFetchBodyLength } from './getFetchBodyLength.ts';

describe('getFetchBodyLength', () => {
  describe('with URL/string first arg', () => {
    it('returns undefined when init has no body', async () => {
      expect(await getFetchBodyLength('http://example.com')).toBeUndefined();
      expect(
        await getFetchBodyLength('http://example.com', {}),
      ).toBeUndefined();
    });

    it('measures a string body', async () => {
      const result = await getFetchBodyLength('http://example.com', {
        body: 'hello',
      });
      expect(result).toBe(5);
    });

    it('measures a multi-byte string body', async () => {
      // '€' is 3 bytes in UTF-8
      const result = await getFetchBodyLength('http://example.com', {
        body: '€',
      });
      expect(result).toBe(3);
    });

    it('measures a Blob body', async () => {
      const blob = new Blob(['hello world']);
      const result = await getFetchBodyLength('http://example.com', {
        body: blob,
      });
      expect(result).toBe(11);
    });

    it('measures a URLSearchParams body', async () => {
      const params = new URLSearchParams({ key: 'value' });
      const result = await getFetchBodyLength('http://example.com', {
        body: params,
      });
      expect(result).toBe(
        new TextEncoder().encode(params.toString()).byteLength,
      );
    });

    it('measures an ArrayBuffer body', async () => {
      const buffer = new ArrayBuffer(16);
      const result = await getFetchBodyLength('http://example.com', {
        body: buffer,
      });
      expect(result).toBe(16);
    });

    it('measures a Uint8Array body', async () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5]);
      const result = await getFetchBodyLength('http://example.com', {
        body: arr,
      });
      expect(result).toBe(5);
    });

    it('measures a FormData body (key + value byte lengths)', async () => {
      const form = new FormData();
      form.append('key', 'value');
      const result = await getFetchBodyLength('http://example.com', {
        body: form,
      });
      // 'key'.length + 'value'.length = 3 + 5 = 8
      expect(result).toBe(8);
    });
  });

  describe('with URL object first arg', () => {
    it('measures a string body', async () => {
      const url = new URL('http://example.com');
      const result = await getFetchBodyLength(url, { body: 'test' });
      expect(result).toBe(4);
    });
  });

  describe('with Request first arg', () => {
    it('returns undefined for a GET request (no body)', async () => {
      const req = new Request('http://example.com');
      const result = await getFetchBodyLength(req);
      expect(result).toBeUndefined();
    });

    it('measures a POST request body', async () => {
      const req = new Request('http://example.com', {
        method: 'POST',
        body: 'hello',
      });
      const result = await getFetchBodyLength(req);
      expect(result).toBe(5);
    });
  });
});

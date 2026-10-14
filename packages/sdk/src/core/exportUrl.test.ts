/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseExportUrl } from './exportUrl.ts';

describe('parseExportUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed URL for http and https URLs', () => {
    const diagErrorSpy = vi.spyOn(diag, 'error');

    expect(parseExportUrl('http://localhost:4318')?.href).toBe(
      'http://localhost:4318/',
    );
    expect(parseExportUrl('https://otlp.example.com/v1/traces')?.href).toBe(
      'https://otlp.example.com/v1/traces',
    );
    expect(diagErrorSpy).not.toHaveBeenCalled();
  });

  it('returns null for a URL without a scheme', () => {
    const diagErrorSpy = vi.spyOn(diag, 'error');

    expect(parseExportUrl('localhost:4318', 'Traces SDK')).toBeNull();
    expect(diagErrorSpy).toHaveBeenCalledWith(
      `Invalid OTLP export URL "localhost:4318". Traces SDK won't start.`,
    );
  });

  it('returns null for an unparseable URL', () => {
    const diagErrorSpy = vi.spyOn(diag, 'error');

    expect(parseExportUrl('this_is_not_an_URL')).toBeNull();
    expect(diagErrorSpy).toHaveBeenCalledWith(
      `Invalid OTLP export URL "this_is_not_an_URL". Browser SDK won't start.`,
    );
  });

  it('works where URL.parse is not available', () => {
    const urlParse = Object.getOwnPropertyDescriptor(URL, 'parse');
    Reflect.deleteProperty(URL, 'parse');

    try {
      expect(URL.parse).toBeUndefined();
      expect(parseExportUrl('http://localhost:4318')?.href).toBe(
        'http://localhost:4318/',
      );
      expect(parseExportUrl('this_is_not_an_URL')).toBeNull();
    } finally {
      if (urlParse) {
        Object.defineProperty(URL, 'parse', urlParse);
      }
    }
  });
});

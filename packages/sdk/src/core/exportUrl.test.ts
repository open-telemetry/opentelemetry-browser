/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseExportUrl, withResourcePath } from './exportUrl.ts';

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

describe('withResourcePath', () => {
  it('keeps the base path when building a per-signal URL', () => {
    expect(
      withResourcePath(
        new URL('http://otlp-path.example:8080/otlp-http'),
        'v1/logs',
      ),
    ).toBe('http://otlp-path.example:8080/otlp-http/v1/logs');
  });

  it('tolerates a trailing slash on the base path', () => {
    expect(
      withResourcePath(
        new URL('http://otlp-path.example:8080/otlp-http/'),
        'v1/traces',
      ),
    ).toBe('http://otlp-path.example:8080/otlp-http/v1/traces');
  });

  it('appends the resource path to an endpoint without a base path', () => {
    // The default endpoint has no path, so the result must match the
    // legacy behavior of plain `/v1/<signal>`
    expect(withResourcePath(new URL('http://localhost:4318'), 'v1/logs')).toBe(
      'http://localhost:4318/v1/logs',
    );
  });

  it('keeps the query string of the base endpoint', () => {
    expect(
      withResourcePath(
        new URL('https://collector.example/collector?key=value'),
        'v1/logs',
      ),
    ).toBe('https://collector.example/collector/v1/logs?key=value');
  });

  it('does not modify the endpoint it was given', () => {
    // Both signals build from the same endpoint URL, so a second call must
    // not append to the result of the first one
    const endpoint = new URL('http://otlp-path.example:8080/otlp-http');
    withResourcePath(endpoint, 'v1/logs');
    expect(withResourcePath(endpoint, 'v1/traces')).toBe(
      'http://otlp-path.example:8080/otlp-http/v1/traces',
    );
    expect(endpoint.pathname).toBe('/otlp-http');
  });
});

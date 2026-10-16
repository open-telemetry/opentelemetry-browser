/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';

/**
 * Parses an OTLP export URL. Returns the parsed {@link URL} or `null` when the
 * URL is invalid, logging a `diag.error` in that case.
 *
 * Callers should bail out (return a NOOP SDK) when this returns `null` so an
 * invalid URL never leaves the SDK silently skipping its exporter while
 * reporting a successful start.
 *
 * @param url The export URL to validate.
 * @param scope Human readable name of the SDK used in the error message.
 * @returns The parsed {@link URL} or `null` when the URL is invalid.
 */
export function parseExportUrl(url: string, scope = 'Browser SDK'): URL | null {
  let parsed: URL | null;
  try {
    // Not `URL.parse`, which Safari < 18 and Chrome/Firefox < 126 lack.
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  // `new URL` accepts any parseable URL, so a missing scheme slips through:
  // `localhost:4318` parses with protocol `localhost:` and an opaque path.
  if (
    !parsed ||
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
  ) {
    diag.error(`Invalid OTLP export URL "${url}". ${scope} won't start.`);
    return null;
  }
  return parsed;
}

/**
 * Builds a per-signal export URL by appending the signal resource path (for
 * example `v1/logs`) to the path of the base endpoint URL.
 *
 * Per the OTLP/HTTP spec, the path of the configured endpoint is a *prefix*
 * of the per-signal URLs rather than something they replace
 * (https://opentelemetry.io/docs/specs/otel/protocol/exporter/#endpoint-urls-for-otlp-http),
 * so a collector behind a proxy path keeps its prefix:
 * `http://collector:8080/otlp-http` exports logs to
 * `http://collector:8080/otlp-http/v1/logs`. A missing trailing slash on the
 * base path is tolerated, matching the other OTLP exporters, so both
 * spellings of the base URL produce the same per-signal URL.
 *
 * @param endpoint The validated base endpoint URL. Not modified.
 * @param resourcePath The signal resource path, without a leading slash.
 * @returns The per-signal export URL string.
 */
export function withResourcePath(endpoint: URL, resourcePath: string): string {
  const url = new URL(endpoint.href);
  if (!url.pathname.endsWith('/')) {
    url.pathname += '/';
  }
  url.pathname += resourcePath;
  return url.href;
}

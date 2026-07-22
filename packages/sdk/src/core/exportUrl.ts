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
  const parsed = URL.parse(url);
  if (!parsed) {
    diag.error(`Invalid OTLP export URL "${url}". ${scope} won't start.`);
  }
  return parsed;
}

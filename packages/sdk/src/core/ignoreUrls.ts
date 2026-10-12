/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Instrumentation } from '@opentelemetry/instrumentation';

/**
 * Appends `urls` to the `ignoreUrls` list of the instrumentation's
 * configuration without dropping or reordering anything the user already
 * configured. Duplicate entries are skipped, and the user's own array is
 * never mutated. The configuration always gets a fresh array.
 *
 * Intended for callers that know in advance which URLs a component will
 * request. The SDK uses it to keep its own export requests out of the
 * network instrumentations it registers, so emitting telemetry cannot
 * recursively trigger new telemetry (e.g. a resource-timing entry for an
 * export firing a new export). See the self-observability supplementary
 * guidelines on avoiding telemetry-induced telemetry loops.
 *
 * Instrumentations that do not support an `ignoreUrls` configuration option
 * ignore the extra entry, so this is safe to call on any instrumentation.
 */
export function appendIgnoreUrls(
  instrumentation: Instrumentation,
  urls: ReadonlyArray<string | RegExp>,
): void {
  if (!Array.isArray(urls) || urls.length === 0) {
    return;
  }
  const config = instrumentation.getConfig() as {
    ignoreUrls?: Array<string | RegExp>;
  };
  const existing = config?.ignoreUrls ?? [];
  const missing = urls.filter(
    (url) => !existing.some((other) => url === other),
  );
  if (missing.length === 0) {
    return;
  }
  instrumentation.setConfig({
    ...config,
    ignoreUrls: [...existing, ...missing],
  } as Parameters<Instrumentation['setConfig']>[0]);
}

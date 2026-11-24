/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';

const API_MAJOR = 1;
const apiSymbol = Symbol.for(`opentelemetry.js.api.${API_MAJOR}`);

export function isDiagRegistered(): boolean {
  // This reads the API's private global and depends on how the API stores it.
  const apiGlobal = globalThis as typeof globalThis & {
    [apiSymbol]?: { diag?: DiagLogger };
  };
  return Boolean(apiGlobal[apiSymbol]?.diag);
}

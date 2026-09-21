/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebSdk } from './types.ts';

// Returned when the SDK is intentionally turned off via `config.disabled`.
export const NOOP_SDK: WebSdk = { shutdown: () => Promise.resolve() };
// Returned when the SDK refuses to start because of an invalid configuration
// (e.g. a bad export URL). `invalidConfig` lets callers tell this apart from an
// intentional disable and surface the mistake.
export const INVALID_CONFIG_SDK: WebSdk = {
  invalidConfig: true,
  shutdown: () => Promise.resolve(),
};

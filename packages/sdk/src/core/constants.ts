/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebSdk } from './types.ts';

// Returned when the SDK refuses to start because of an invalid configuration
// (e.g. a bad export URL), so callers can surface the mistake.
export const INVALID_CONFIG_SDK: WebSdk = {
  invalidConfig: true,
  enable: () => {},
  disable: () => {},
  shutdown: () => Promise.resolve(),
};

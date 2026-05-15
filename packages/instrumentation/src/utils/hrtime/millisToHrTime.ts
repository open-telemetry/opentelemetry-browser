/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HrTime } from '@opentelemetry/api';

export function millisToHrTime(millis: number): HrTime {
  const secs = Math.floor(millis / 1000);
  const ns = Math.round((millis - secs * 1000) * 1e6);
  return [secs, ns];
}

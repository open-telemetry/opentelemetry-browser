/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HrTime } from '@opentelemetry/api';
import { millisToHrTime } from './millisToHrTime.ts';

/** Converts a performance.now() value to an absolute wall-clock HrTime. */
export function perfNowToAbsoluteHrTime(perfNow: number): HrTime {
  return millisToHrTime(performance.timeOrigin + perfNow);
}

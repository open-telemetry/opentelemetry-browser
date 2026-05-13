/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HrTime } from '@opentelemetry/api';

const NANOSECOND_DIGITS = 9;
const NANOSECOND_DIGITS_IN_MILLIS = 6;
const MILLISECONDS_TO_NANOSECONDS = 10 ** NANOSECOND_DIGITS_IN_MILLIS;
const SECOND_TO_NANOSECONDS = 10 ** NANOSECOND_DIGITS;

/**
 * Converts a number of milliseconds from epoch to HrTime([seconds, remainder in nanoseconds]).
 * @param epochMillis
 */
export function millisToHrTime(epochMillis: number): HrTime {
  const epochSeconds = epochMillis / 1000;
  // Decimals only.
  const seconds = Math.trunc(epochSeconds);
  // Round sub-nanosecond accuracy to nanosecond.
  const nanos = Math.round((epochMillis % 1000) * MILLISECONDS_TO_NANOSECONDS);
  return [seconds, nanos];
}

/**
 * Given 2 HrTime formatted times, return their sum as an HrTime.
 */
export function addHrTimes(time1: HrTime, time2: HrTime): HrTime {
  const out = [time1[0] + time2[0], time1[1] + time2[1]] as HrTime;

  // Nanoseconds
  if (out[1] >= SECOND_TO_NANOSECONDS) {
    out[1] -= SECOND_TO_NANOSECONDS;
    out[0] += 1;
  }

  return out;
}

/**
 * Returns an hrtime calculated via performance component.
 * @param performanceNow
 */
export function hrTime(performanceNow?: number): HrTime {
  const timeOrigin = millisToHrTime(performance.timeOrigin);
  const now = millisToHrTime(
    typeof performanceNow === 'number' ? performanceNow : performance.now(),
  );

  return addHrTimes(timeOrigin, now);
}

/**
 * Convert hrTime to nanoseconds.
 * @param time
 */
export function hrTimeToNanoseconds(time: HrTime): number {
  return time[0] * SECOND_TO_NANOSECONDS + time[1];
}

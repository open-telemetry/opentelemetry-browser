/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { millisToHrTime } from './millisToHrTime.ts';
import { perfNowToAbsoluteHrTime } from './perfNowToAbsoluteHrTime.ts';

describe('perfNowToAbsoluteHrTime', () => {
  it('adds performance.timeOrigin to the given perfNow value', () => {
    const origin = 1_700_000_000_000;
    vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(origin);

    const perfNow = 250;
    const result = perfNowToAbsoluteHrTime(perfNow);
    expect(result).toEqual(millisToHrTime(origin + perfNow));

    vi.restoreAllMocks();
  });

  it('returns an absolute HrTime with seconds and nanoseconds', () => {
    vi.spyOn(performance, 'timeOrigin', 'get').mockReturnValue(1_000_000);

    const [secs, ns] = perfNowToAbsoluteHrTime(500);
    expect(secs).toBe(1000); // (1_000_000 + 500) / 1000 = 1000.5 → floor = 1000
    expect(ns).toBe(500_000_000); // 0.5 s = 500_000_000 ns

    vi.restoreAllMocks();
  });
});

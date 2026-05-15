/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { millisToHrTime } from './millisToHrTime.ts';

describe('millisToHrTime', () => {
  it('converts zero milliseconds', () => {
    expect(millisToHrTime(0)).toEqual([0, 0]);
  });

  it('converts whole seconds', () => {
    expect(millisToHrTime(2000)).toEqual([2, 0]);
  });

  it('converts milliseconds with a fractional second', () => {
    expect(millisToHrTime(1500)).toEqual([1, 500_000_000]);
  });

  it('converts 1 millisecond', () => {
    expect(millisToHrTime(1)).toEqual([0, 1_000_000]);
  });

  it('converts a large epoch-like value', () => {
    // 1_700_000_000_000 ms = 1_700_000_000 s, 0 ns
    const [secs, ns] = millisToHrTime(1_700_000_000_000);
    expect(secs).toBe(1_700_000_000);
    expect(ns).toBe(0);
  });

  it('handles sub-millisecond precision via rounding', () => {
    // 1001.5 ms → 1 s + 1.5ms = 1 s + 1_500_000 ns
    const [secs, ns] = millisToHrTime(1001.5);
    expect(secs).toBe(1);
    expect(ns).toBe(1_500_000);
  });
});

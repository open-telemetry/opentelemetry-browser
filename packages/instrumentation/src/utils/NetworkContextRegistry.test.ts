/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { TraceFlags, trace } from '@opentelemetry/api';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getNetworkContextRegistry,
  NetworkContextRegistry,
} from './NetworkContextRegistry.ts';

function makeSpan(traceId: string, spanId: string) {
  return trace.wrapSpanContext({
    traceId,
    spanId,
    traceFlags: TraceFlags.SAMPLED,
    isRemote: false,
  });
}

function makeEntry(
  url: string,
  fetchStart: number,
  responseEnd: number,
): PerformanceResourceTiming {
  return { name: url, fetchStart, responseEnd } as PerformanceResourceTiming;
}

describe('NetworkContextRegistry', () => {
  let registry: NetworkContextRegistry;

  beforeEach(() => {
    registry = new NetworkContextRegistry();
  });

  describe('getContext', () => {
    it('returns undefined when no spans are registered', () => {
      const entry = makeEntry('https://example.com/api', 100, 200);
      expect(registry.getContext(entry)).toBeUndefined();
    });

    it('returns undefined when URL does not match', () => {
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));
      registry.register(span, {
        key: 'https://example.com/api',
        startPerfNow: 100,
        endPerfNow: 200,
      });

      const entry = makeEntry('https://example.com/other', 100, 200);
      expect(registry.getContext(entry)).toBeUndefined();
    });

    it('returns undefined when entry falls outside the timing window', () => {
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));
      registry.register(span, {
        key: 'https://example.com/api',
        startPerfNow: 100,
        endPerfNow: 200,
      });

      // fetchStart before span start
      expect(
        registry.getContext(makeEntry('https://example.com/api', 50, 180)),
      ).toBeUndefined();

      // responseEnd after span end
      expect(
        registry.getContext(makeEntry('https://example.com/api', 110, 250)),
      ).toBeUndefined();
    });

    it('returns the context for a matching entry', () => {
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));
      registry.register(span, {
        key: 'https://example.com/api',
        startPerfNow: 100,
        endPerfNow: 200,
      });

      const entry = makeEntry('https://example.com/api', 110, 190);
      const ctx = registry.getContext(entry);

      expect(ctx && trace.getSpan(ctx)?.spanContext().traceId).toBe(
        'a'.repeat(32),
      );
      expect(ctx && trace.getSpan(ctx)?.spanContext().spanId).toBe(
        'b'.repeat(16),
      );
    });

    it('matches entries at the exact boundaries of the timing window', () => {
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));
      registry.register(span, {
        key: 'https://example.com/api',
        startPerfNow: 100,
        endPerfNow: 200,
      });

      const entry = makeEntry('https://example.com/api', 100, 200);
      expect(registry.getContext(entry)).toBeDefined();
    });

    it('returns the correct context when multiple spans share the same URL', () => {
      const span1 = makeSpan('1'.repeat(32), '1'.repeat(16));
      const span2 = makeSpan('2'.repeat(32), '2'.repeat(16));
      registry.register(span1, {
        key: 'https://example.com/api',
        startPerfNow: 100,
        endPerfNow: 200,
      });
      registry.register(span2, {
        key: 'https://example.com/api',
        startPerfNow: 300,
        endPerfNow: 400,
      });

      const ctx1 = registry.getContext(
        makeEntry('https://example.com/api', 110, 190),
      );
      const ctx2 = registry.getContext(
        makeEntry('https://example.com/api', 310, 390),
      );

      expect(ctx1 && trace.getSpan(ctx1)?.spanContext().traceId).toBe(
        '1'.repeat(32),
      );
      expect(ctx2 && trace.getSpan(ctx2)?.spanContext().traceId).toBe(
        '2'.repeat(32),
      );
    });
  });
});

describe('getNetworkContextRegistry', () => {
  it('returns the same instance on every call', () => {
    expect(getNetworkContextRegistry()).toBe(getNetworkContextRegistry());
  });
});

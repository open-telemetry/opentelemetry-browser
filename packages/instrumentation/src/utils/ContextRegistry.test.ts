/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import { TraceFlags, trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';
import { ContextRegistry } from './ContextRegistry.ts';

interface TestData {
  key: string;
  value: number;
}

class TestRegistry extends ContextRegistry<TestData, string> {
  getContext(key: string): Context | undefined {
    return this._records.get(key)?.[0]?.ctx;
  }
}

function makeSpan(traceId: string, spanId: string) {
  return trace.wrapSpanContext({
    traceId,
    spanId,
    traceFlags: TraceFlags.SAMPLED,
    isRemote: false,
  });
}

describe('ContextRegistry', () => {
  describe('register', () => {
    it('stores the span context under data.key', () => {
      const registry = new TestRegistry();
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));

      registry.register(span, { key: 'foo', value: 1 });

      const ctx = registry.getContext('foo');
      expect(ctx && trace.getSpan(ctx)?.spanContext().traceId).toBe(
        'a'.repeat(32),
      );
    });

    it('merges additional data fields into the stored record', () => {
      const registry = new TestRegistry();
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));

      registry.register(span, { key: 'foo', value: 42 });

      const record = registry['_records'].get('foo')?.[0];
      expect(record?.value).toBe(42);
    });

    it('accumulates multiple entries under the same key', () => {
      const registry = new TestRegistry();
      const span1 = makeSpan('1'.repeat(32), '1'.repeat(16));
      const span2 = makeSpan('2'.repeat(32), '2'.repeat(16));

      registry.register(span1, { key: 'foo', value: 1 });
      registry.register(span2, { key: 'foo', value: 2 });

      expect(registry['_records'].get('foo')).toHaveLength(2);
    });

    it('keeps entries for different keys separate', () => {
      const registry = new TestRegistry();
      const span1 = makeSpan('1'.repeat(32), '1'.repeat(16));
      const span2 = makeSpan('2'.repeat(32), '2'.repeat(16));

      registry.register(span1, { key: 'foo', value: 1 });
      registry.register(span2, { key: 'bar', value: 2 });

      const fooCtx = registry.getContext('foo');
      const barCtx = registry.getContext('bar');
      expect(fooCtx && trace.getSpan(fooCtx)?.spanContext().traceId).toBe(
        '1'.repeat(32),
      );
      expect(barCtx && trace.getSpan(barCtx)?.spanContext().traceId).toBe(
        '2'.repeat(32),
      );
    });
  });
});

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
  getDataKey(data: TestData): string {
    return data.key;
  }

  getLookupKey(lookup: string): string {
    return lookup;
  }

  getContext(key: string): Context | undefined {
    return this._recordsByKey.get(key)?.[0]?.ctx;
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
      expect(registry.size()).toEqual(1);
    });

    it('merges additional data fields into the stored record', () => {
      const registry = new TestRegistry();
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));

      registry.register(span, { key: 'foo', value: 42 });

      const record = registry['_recordsByKey'].get('foo')?.[0];
      expect(record?.value).toBe(42);
      expect(registry.size()).toEqual(1);
    });

    it('accumulates multiple entries under the same key', () => {
      const registry = new TestRegistry();
      const span1 = makeSpan('1'.repeat(32), '1'.repeat(16));
      const span2 = makeSpan('2'.repeat(32), '2'.repeat(16));

      registry.register(span1, { key: 'foo', value: 1 });
      registry.register(span2, { key: 'foo', value: 2 });

      expect(registry['_recordsByKey'].get('foo')).toHaveLength(2);
      expect(registry.size()).toEqual(2);
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
      expect(registry.size()).toEqual(2);
    });
  });

  describe('unregister', () => {
    it('removes the matching record for the given lookup', () => {
      const registry = new TestRegistry();
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));

      registry.register(span, { key: 'foo', value: 1 });
      registry.unregister('foo');

      expect(registry.getContext('foo')).toBeUndefined();
      expect(registry.size()).toEqual(0);
    });

    it('deletes the key when the last record is removed', () => {
      const registry = new TestRegistry();
      const span = makeSpan('a'.repeat(32), 'b'.repeat(16));

      registry.register(span, { key: 'foo', value: 1 });
      registry.unregister('foo');

      expect(registry['_recordsByKey'].has('foo')).toBe(false);
      expect(registry.size()).toEqual(0);
    });

    it('removes only the matching record when multiple entries share the same key', () => {
      const registry = new TestRegistry();
      const span1 = makeSpan('1'.repeat(32), '1'.repeat(16));
      const span2 = makeSpan('2'.repeat(32), '2'.repeat(16));

      registry.register(span1, { key: 'foo', value: 1 });
      registry.register(span2, { key: 'foo', value: 2 });

      registry.unregister('foo');

      expect(registry['_recordsByKey'].get('foo')).toHaveLength(1);
      expect(registry.size()).toEqual(1);
    });

    it('does not affect entries for other keys', () => {
      const registry = new TestRegistry();
      const span1 = makeSpan('1'.repeat(32), '1'.repeat(16));
      const span2 = makeSpan('2'.repeat(32), '2'.repeat(16));

      registry.register(span1, { key: 'foo', value: 1 });
      registry.register(span2, { key: 'bar', value: 2 });
      registry.unregister('foo');

      expect(registry.getContext('foo')).toBeUndefined();
      expect(registry.getContext('bar')).toBeDefined();
      expect(registry.size()).toEqual(1);
    });

    it('is a no-op when the lookup does not match any record', () => {
      const registry = new TestRegistry();

      expect(() => registry.unregister('unknown')).not.toThrow();
      expect(registry.size()).toEqual(0);
    });
  });

  describe('capacity', () => {
    it('removes the oldest record when it reaches the max capacity', () => {
      const registry = new TestRegistry();
      for (let i = 0; i < 1000; i++) {
        registry.register(makeSpan('a'.repeat(32), 'b'.repeat(16)), {
          key: `key-${i}`,
          value: i,
        });
      }
      expect(registry.size()).toEqual(1000);

      // This last registration overflows
      registry.register(makeSpan('a'.repeat(32), 'b'.repeat(16)), {
        key: `key-${1000}`,
        value: 1000,
      });
      expect(registry.getContext('key-0')).toBeUndefined();
      expect(registry.size()).toEqual(1000);
    });

    it('does not remove records if there is still capacity', () => {
      const registry = new TestRegistry();
      for (let i = 0; i < 1000; i++) {
        registry.register(makeSpan('a'.repeat(32), 'b'.repeat(16)), {
          key: `key-${i}`,
          value: i,
        });
      }
      expect(registry.size()).toEqual(1000);

      // Remove a couple of records
      registry.unregister('key-200');
      registry.unregister('key-250');

      // This last registration should not remove the oldest record
      registry.register(makeSpan('a'.repeat(32), 'b'.repeat(16)), {
        key: `key-${1000}`,
        value: 1000,
      });
      expect(registry.getContext('key-0')).toBeDefined();
      expect(registry.getContext('key-200')).toBeUndefined();
      expect(registry.getContext('key-250')).toBeUndefined();
      expect(registry.getContext('key-1000')).toBeDefined();
      expect(registry.size()).toEqual(999);
    });
  });
});

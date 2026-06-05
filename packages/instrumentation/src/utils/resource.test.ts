/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import { beforeAll, describe, expect, it } from 'vitest';
import { findContextForResource, setContextForResource } from './resource.ts';

function createContext(val: string): Context {
  return {
    getValue: (): unknown => val,
    setValue: function (): Context {
      return this;
    },
    deleteValue: function (): Context {
      return this;
    },
  };
}

describe('findContextForResource', () => {
  describe('when no context is saved for resources', () => {
    it('should return undefined', () => {
      expect(findContextForResource(() => true)).toBeUndefined();
    });
  });

  describe('when context is saved for resources', () => {
    const startTime = performance.now();
    const endTime = startTime + 300;

    beforeAll(() => {
      // Set different resources with the same timing
      setContextForResource(
        { url: 'url1', startTime, endTime },
        createContext('1'),
      );
      setContextForResource(
        { url: 'url2', startTime, endTime },
        createContext('2'),
      );
      // Set same resource again with different timings (100ms later)
      setContextForResource(
        {
          url: 'url1',
          startTime: startTime + 100,
          endTime: endTime + 100,
        },
        createContext('3'),
      );
    });

    it('should return undefined if no resource satisfies the predicate', () => {
      expect(
        findContextForResource((r) => r.url === 'unknown'),
      ).toBeUndefined();
    });

    it('should return the 1st entry matching the predicate', () => {
      let ctx = findContextForResource((r) => r.url === 'url1');
      expect(ctx).toBeDefined();
      expect(ctx?.getValue(Symbol.for('test'))).toBe('1');

      ctx = findContextForResource((r) => r.url === 'url2');
      expect(ctx).toBeDefined();
      expect(ctx?.getValue(Symbol.for('test'))).toBe('2');

      ctx = findContextForResource(
        (r) => r.url === 'url1' && r.startTime >= startTime + 50,
      );
      expect(ctx).toBeDefined();
      expect(ctx?.getValue(Symbol.for('test'))).toBe('3');
    });

    it('should return undefined if all resources are expired', async () => {
      await new Promise((r) => setTimeout(r, 1000));

      let ctx = findContextForResource((r) => r.url === 'url1');
      expect(ctx).toBeUndefined();

      ctx = findContextForResource((r) => r.url === 'url2');
      expect(ctx).toBeUndefined();

      ctx = findContextForResource(
        (r) => r.url === 'url1' && r.startTime >= startTime + 50,
      );
      expect(ctx).toBeUndefined();

      ctx = findContextForResource(() => true);
      expect(ctx).toBeUndefined();
    });

    it('should keep the context for a specific TTL', async () => {
      const now = performance.now();
      const res = { url: 'test', startTime: now, endTime: now };
      const ctx = createContext('t');
      setContextForResource(res, ctx, 300);

      await new Promise((r) => setTimeout(r, 100));
      let ctx2 = findContextForResource((r) => r.url === 'test');
      expect(ctx2).toBe(ctx);

      await new Promise((r) => setTimeout(r, 300));
      ctx2 = findContextForResource((r) => r.url === 'test');
      expect(ctx2).toBeUndefined();
    });
  });
});

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';
import { getContextForResource, setContextForResource } from './resource.ts';

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

describe('getContextForResource', () => {
  describe('when no context is saved for resources', () => {
    it('should return undefined', () => {
      const fetchStart = performance.now();
      const responseEnd = fetchStart + 300;
      expect(
        getContextForResource({ name: 'test', fetchStart, responseEnd }),
      ).toBeUndefined();
    });
  });

  describe('when context is saved for resources', () => {
    const fetchStart = performance.now();
    const responseEnd = fetchStart + 300;

    // Set different resources with the same timing
    setContextForResource(
      { name: 'url1', fetchStart, responseEnd },
      createContext('1'),
    );
    setContextForResource(
      { name: 'url2', fetchStart, responseEnd },
      createContext('2'),
    );
    // Set same resource again with different timings (100ms later)
    setContextForResource(
      {
        name: 'url1',
        fetchStart: fetchStart + 100,
        responseEnd: responseEnd + 100,
      },
      createContext('3'),
    );

    it('should return undefined if no resource has the name', () => {
      expect(
        getContextForResource({ name: 'unknown', fetchStart, responseEnd }),
      ).toBeUndefined();
    });

    it('should return undefined if matches name but not times', () => {
      // Starts sooner
      expect(
        getContextForResource({
          name: 'url1',
          fetchStart: fetchStart - 1,
          responseEnd,
        }),
      ).toBeUndefined();
      // Ends later
      expect(
        getContextForResource({
          name: 'url1',
          fetchStart,
          responseEnd: responseEnd + 1,
        }),
      ).toBeUndefined();
    });

    it('should return a context if there is a match', () => {
      const ctx1 = getContextForResource({
        name: 'url1',
        fetchStart,
        responseEnd,
      });
      expect(ctx1).toBeDefined();
      expect(ctx1?.getValue(Symbol.for('test'))).toStrictEqual('1');

      const ctx2 = getContextForResource({
        name: 'url2',
        fetchStart,
        responseEnd,
      });
      expect(ctx2).toBeDefined();
      expect(ctx2?.getValue(Symbol.for('test'))).toStrictEqual('2');

      const ctx3 = getContextForResource({
        name: 'url1',
        fetchStart: fetchStart + 100,
        responseEnd: responseEnd + 100,
      });
      expect(ctx3).toBeDefined();
      expect(ctx3?.getValue(Symbol.for('test'))).toStrictEqual('3');
    });

    it('should return undefined if all resources are expired', async () => {
      await new Promise((r) => setTimeout(r, 1000));

      const ctx1 = getContextForResource({
        name: 'url1',
        fetchStart,
        responseEnd,
      });
      expect(ctx1).toBeUndefined();

      const ctx2 = getContextForResource({
        name: 'url2',
        fetchStart,
        responseEnd,
      });
      expect(ctx2).toBeUndefined();

      const ctx3 = getContextForResource({
        name: 'url1',
        fetchStart: fetchStart + 100,
        responseEnd: responseEnd + 100,
      });
      expect(ctx3).toBeUndefined();
    });

    it('should keep the context for a specific TTL', async () => {
      const res = { name: 'test', fetchStart, responseEnd };
      const ctx = createContext('t');
      setContextForResource(res, ctx, 300);

      await new Promise((r) => setTimeout(r, 100));
      let ctx2 = getContextForResource(res);
      expect(ctx2).toBe(ctx);

      await new Promise((r) => setTimeout(r, 300));
      ctx2 = getContextForResource(res);
      expect(ctx2).toBeUndefined();
    });
  });
});

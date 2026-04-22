/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextManager } from '@opentelemetry/api';
import { createContextKey, ROOT_CONTEXT } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDefaultContextManager } from './context.ts';

describe('Default ContextManager', () => {
  const key1 = createContextKey('test key 1');
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = getDefaultContextManager();
    contextManager.enable();
  });

  afterEach(() => {
    contextManager.disable();
  });

  describe('.enable()', () => {
    it('should work', () => {
      expect(contextManager.enable()).toBe(contextManager);
      expect(contextManager.active()).toBe(ROOT_CONTEXT);
    });
  });

  describe('.disable()', () => {
    it('should work', () => {
      expect(contextManager.disable()).toBe(contextManager);
      expect(contextManager.active()).toBe(ROOT_CONTEXT);
    });
  });

  describe('.with()', () => {
    it('should run the callback (null as context)', () => {
      return new Promise((done) => {
        contextManager.with(null as any, done as any);
      });
    });

    it('should run the callback (object as target)', () => {
      const test = ROOT_CONTEXT.setValue(key1, 1);

      return new Promise((done) => {
        contextManager.with(test, () => {
          expect(contextManager.active()).toBe(test);
          return done(null);
        });
      });
    });

    it('should run the callback (when disabled)', () => {
      contextManager.disable();
      return new Promise((done) => {
        contextManager.with(null as any, () => {
          contextManager.enable();
          return done(null);
        });
      });
    });

    it('should rethrow errors', () => {
      expect(() => {
        contextManager.with(contextManager.active(), () => {
          throw new Error('This should be rethrown');
        });
      }).throws();
    });

    it('should stack and restore context', () => {
      const ctx1 = ROOT_CONTEXT.setValue(key1, 'ctx1');
      const ctx2 = ROOT_CONTEXT.setValue(key1, 'ctx2');
      const ctx3 = ROOT_CONTEXT.setValue(key1, 'ctx3');
      contextManager.with(ctx1, () => {
        expect(contextManager.active()).toBe(ctx1);
        contextManager.with(ctx2, () => {
          expect(contextManager.active()).toBe(ctx2);
          contextManager.with(ctx3, () => {
            expect(contextManager.active()).toBe(ctx3);
          });
          expect(contextManager.active()).toBe(ctx2);
        });
        expect(contextManager.active()).toBe(ctx1);
      });
      expect(contextManager.active()).toBe(ROOT_CONTEXT);
    });

    it('should forward this, arguments and return value', () => {
      function fnWithThis(this: string, a: string, b: number): string {
        expect(this).toEqual('that');
        expect(arguments.length).toEqual(2);
        expect(a).toEqual('one');
        expect(b).toEqual(2);
        return 'done';
      }

      const res = contextManager.with(
        ROOT_CONTEXT,
        fnWithThis,
        'that',
        'one',
        2,
      );
      expect(res).toEqual('done');
      expect(contextManager.with(ROOT_CONTEXT, () => 3.14)).toEqual(3.14);
    });
  });
});

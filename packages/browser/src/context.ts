/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, ContextManager } from '@opentelemetry/api';
import { ROOT_CONTEXT } from '@opentelemetry/api';

/**
 * Returns a simple context manager which stack
 * @returns {ContextManager}
 */
export function getDefaultContextManager(): ContextManager {
  let _currentContext = ROOT_CONTEXT;
  let _enabled = false;

  return {
    active: (): Context => _currentContext,
    with: <A extends unknown[], F extends (...args: A) => ReturnType<F>>(
      context: Context,
      fn: F,
      thisArg?: ThisParameterType<F>,
      ...args: A
    ): ReturnType<F> => {
      const previousContext = _currentContext;
      _currentContext = context || ROOT_CONTEXT;
      try {
        return fn.call(thisArg, ...args);
      } finally {
        _currentContext = previousContext;
      }
    },
    bind: function <T>(context: Context, target: T): T {
      // if no specific context to propagate is given, we use the current one
      if (context === undefined) {
        context = this.active();
      }
      if (typeof target === 'function') {
        const manager = this;
        const contextWrapper = function (this: unknown, ...args: unknown[]) {
          return manager.with(context, () => target.apply(this, args));
        };
        Object.defineProperty(contextWrapper, 'length', {
          enumerable: false,
          configurable: true,
          writable: false,
          value: target.length,
        });
        return contextWrapper as unknown as T;
      }
      return target;
    },
    enable: function (): ContextManager {
      if (!_enabled) {
        _currentContext = ROOT_CONTEXT;
        _enabled = true;
      }
      return this;
    },
    disable: function (): ContextManager {
      _currentContext = ROOT_CONTEXT;
      _enabled = false;
      return this;
    },
  };
}

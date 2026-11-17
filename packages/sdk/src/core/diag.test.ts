/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDefaultLogger } from './diag.ts';

// The API's console logger keeps the console methods it saw when it loaded,
// so a spy on `console` would not see its calls.
const printedCalls = vi.hoisted(() => [] as [string, unknown[]][]);
vi.mock('@opentelemetry/api', async (importOriginal) => {
  const api = await importOriginal<typeof import('@opentelemetry/api')>();
  const method =
    (name: string) =>
    (...args: unknown[]) =>
      printedCalls.push([name, args]);
  class FakeConsoleLogger {
    error = method('error');
    warn = method('warn');
    info = method('info');
    debug = method('debug');
    verbose = method('verbose');
  }
  return { ...api, DiagConsoleLogger: FakeConsoleLogger };
});

describe('getDefaultLogger', () => {
  function logEverything(level: Parameters<typeof getDefaultLogger>[0]) {
    const logger = getDefaultLogger(level);
    logger.error('error');
    logger.warn('warn');
    logger.info('info');
    logger.debug('debug');
    logger.verbose('verbose');
  }

  function printed() {
    return printedCalls.map(([name]) => name);
  }

  afterEach(() => {
    printedCalls.length = 0;
  });

  it('should return the same logger for the same level', () => {
    expect(getDefaultLogger('WARN')).toBe(getDefaultLogger('WARN'));
    expect(getDefaultLogger('WARN')).not.toBe(getDefaultLogger('DEBUG'));
  });

  it('should default to INFO', () => {
    expect(getDefaultLogger()).toBe(getDefaultLogger('INFO'));
  });

  it('should print only the given level and louder', () => {
    logEverything('WARN');
    expect(printed()).toEqual(['error', 'warn']);
  });

  it('should print everything at ALL', () => {
    logEverything('ALL');
    expect(printed()).toEqual(['error', 'warn', 'info', 'debug', 'verbose']);
  });

  it('should print nothing at NONE', () => {
    logEverything('NONE');
    expect(printed()).toEqual([]);
  });

  it('should fall back to INFO for an unknown level', () => {
    // @ts-expect-error: checking a value the types don't allow
    expect(getDefaultLogger('LOUD')).toBe(getDefaultLogger('INFO'));
  });

  it('should pass the message and arguments to the console', () => {
    getDefaultLogger('INFO').info('message', { a: 1 });
    expect(printedCalls).toEqual([['info', ['message', { a: 1 }]]]);
  });
});

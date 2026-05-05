/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { setupTestLogExporter } from '#utils/test';
import { ConsoleInstrumentation } from './instrumentation.ts';
import { ATTR_CONSOLE_METHOD, CONSOLE_LOG_EVENT_NAME } from './semconv.ts';

describe('ConsoleInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: ConsoleInstrumentation;
  let originalConsole: Console;

  beforeAll(() => {
    originalConsole = globalThis.console;
    globalThis.console = {
      error: () => {},
      log: () => {},
      info: () => {},
      warn: () => {},
      trace: () => {},
      debug: () => {},
    } as unknown as Console;
    inMemoryExporter = setupTestLogExporter();
  });

  afterAll(() => {
    globalThis.console = originalConsole;
  });

  beforeEach(() => {
    inMemoryExporter.reset();
    instrumentation = new ConsoleInstrumentation();
  });

  afterEach(() => {
    instrumentation.disable();
  });

  describe('severity mapping', () => {
    it('should emit a log with DEBUG severity for console.debug', () => {
      console.debug('debug message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);

      const log = logs[0];
      expect(log?.severityNumber).toBe(SeverityNumber.DEBUG);
      expect(log?.severityText).toBe('debug');
      expect(log?.body).toBe('debug message');
      expect(log?.eventName).toBe(CONSOLE_LOG_EVENT_NAME);
      expect(log?.attributes[ATTR_CONSOLE_METHOD]).toBe('debug');
    });

    it('should emit a log with INFO severity for console.log', () => {
      console.log('log message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);

      const log = logs[0];
      expect(log?.severityNumber).toBe(SeverityNumber.INFO);
      expect(log?.severityText).toBe('log');
      expect(log?.body).toBe('log message');
      expect(log?.attributes[ATTR_CONSOLE_METHOD]).toBe('log');
    });

    it('should emit a log with INFO severity for console.info', () => {
      console.info('info message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);

      const log = logs[0];
      expect(log?.severityNumber).toBe(SeverityNumber.INFO);
      expect(log?.severityText).toBe('info');
      expect(log?.body).toBe('info message');
      expect(log?.attributes[ATTR_CONSOLE_METHOD]).toBe('info');
    });

    it('should emit a log with WARN severity for console.warn', () => {
      console.warn('warn message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);

      const log = logs[0];
      expect(log?.severityNumber).toBe(SeverityNumber.WARN);
      expect(log?.severityText).toBe('warn');
      expect(log?.body).toBe('warn message');
      expect(log?.attributes[ATTR_CONSOLE_METHOD]).toBe('warn');
    });

    it('should emit a log with ERROR severity for console.error', () => {
      console.error('error message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);

      const log = logs[0];
      expect(log?.severityNumber).toBe(SeverityNumber.ERROR);
      expect(log?.severityText).toBe('error');
      expect(log?.body).toBe('error message');
      expect(log?.attributes[ATTR_CONSOLE_METHOD]).toBe('error');
    });
  });

  describe('logMethods config', () => {
    it('should only instrument configured methods', () => {
      instrumentation.disable();
      inMemoryExporter.reset();
      instrumentation = new ConsoleInstrumentation({
        enabled: true,
        logMethods: ['error', 'warn'],
      });

      console.log('log message');
      console.info('info message');
      console.debug('debug message');
      console.warn('warn message');
      console.error('error message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(2);

      expect(logs[0]?.severityText).toBe('warn');
      expect(logs[1]?.severityText).toBe('error');
    });

    it('should not emit any logs when logMethods is empty', () => {
      instrumentation.disable();
      inMemoryExporter.reset();
      instrumentation = new ConsoleInstrumentation({
        enabled: true,
        logMethods: [],
      });

      console.log('log message');
      console.warn('warn message');
      console.error('error message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(0);
    });

    it('should respect logMethods updates via setConfig at runtime', () => {
      instrumentation.setConfig({ logMethods: ['error'] });

      console.log('log message');
      console.warn('warn message');
      console.error('error message');

      let logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.severityText).toBe('error');

      inMemoryExporter.reset();
      instrumentation.setConfig({ logMethods: ['log', 'warn'] });

      console.log('log message');
      console.warn('warn message');
      console.error('error message');

      logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(2);
      expect(logs[0]?.severityText).toBe('log');
      expect(logs[1]?.severityText).toBe('warn');
    });
  });

  describe('default serialization', () => {
    it('should serialize primitive values', () => {
      console.log('string', 123, true, null, undefined);

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('string 123 true null undefined');
    });

    it('should serialize objects as JSON', () => {
      console.log({ name: 'test', value: 42 });

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('{"name":"test","value":42}');
    });

    it('should serialize multiple arguments', () => {
      console.log('User:', { id: 1 }, 'logged in');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('User: {"id":1} logged in');
    });

    it('should serialize arrays as JSON', () => {
      console.log([1, 2, 3]);

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('[1,2,3]');
    });
  });

  describe('custom messageSerializer', () => {
    it('should use custom serializer when provided', () => {
      instrumentation.disable();
      instrumentation = new ConsoleInstrumentation({
        enabled: true,
        messageSerializer: (args) =>
          args.map((arg) => `[${typeof arg}]`).join('-'),
      });

      console.log('hello', 123, { test: true });

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('[string]-[number]-[object]');
    });
  });

  describe('circular reference handling', () => {
    it('should handle circular references by falling back to String()', () => {
      const circularObj: Record<string, unknown> = { name: 'circular' };
      circularObj['self'] = circularObj;

      console.log(circularObj);

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      // Should fall back to String() which returns [object Object]
      expect(logs[0]?.body).toBe('[object Object]');
    });
  });

  describe('original console behavior', () => {
    it('should still call the original console method', () => {
      let called = false;
      const originalLog = console.log;

      console.log = (...args: unknown[]) => {
        called = true;
        originalLog.apply(console, args);
      };

      instrumentation = new ConsoleInstrumentation();

      console.log('test');

      expect(called).toBe(true);

      instrumentation.disable();
      console.log = originalLog;
    });
  });

  describe('enable/disable lifecycle', () => {
    it('should not emit logs when disabled', () => {
      instrumentation.disable();
      inMemoryExporter.reset();

      console.log('should not be captured');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(0);

      // enable instrumentation again
      instrumentation.enable();
    });

    it('should emit logs when re-enabled', () => {
      instrumentation.disable();
      inMemoryExporter.reset();
      instrumentation.enable();

      console.log('should be captured');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('should be captured');
    });

    it('should keep console methods patched after disable (patch-once pattern)', () => {
      const wrappedLog = console.log;

      instrumentation.disable();

      // After disable, console.log remains wrapped but is a no-op for emitting logs.
      // This avoids unpatch-order issues when multiple instrumentations wrap the same API.
      expect(console.log).toBe(wrappedLog);

      // enable instrumentation again
      instrumentation.enable();
    });

    it('should not wrap console methods multiple times when enable() is called repeatedly', () => {
      inMemoryExporter.reset();

      instrumentation.enable();
      instrumentation.enable();
      instrumentation.enable();

      console.log('single log message');

      const logs = inMemoryExporter.getFinishedLogRecords();
      expect(logs.length).toBe(1);
      expect(logs[0]?.body).toBe('single log message');
    });
  });
});

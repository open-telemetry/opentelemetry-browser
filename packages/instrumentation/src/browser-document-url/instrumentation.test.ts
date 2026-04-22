/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestLogExporter } from '#instrumentation-test-utils';
import { BrowserDocumentUrlInstrumentation } from './instrumentation.ts';
import { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';

describe('BrowserDocumentUrlInstrumentation', () => {
  /**
   * A single, shared instrumentation instance lives in the global logger
   * provider's processor list for the lifetime of this test file. Individual
   * tests enable or disable it to exercise behavior.
   *
   * Using a single setupTestLogExporter call is required because
   * `logs.setGlobalLoggerProvider` is a one-time operation per jsdom
   * environment — subsequent calls are no-ops.
   */
  let exporter: InMemoryLogRecordExporter;
  let instrumentation: BrowserDocumentUrlInstrumentation;

  beforeAll(() => {
    instrumentation = new BrowserDocumentUrlInstrumentation({ enabled: false });
    exporter = setupTestLogExporter([instrumentation]);
  });

  beforeEach(() => {
    exporter.reset();
  });

  afterEach(() => {
    instrumentation.disable();
  });

  it('should create an instance of BrowserDocumentUrlInstrumentation', () => {
    expect(instrumentation).toBeInstanceOf(BrowserDocumentUrlInstrumentation);
  });

  it('should enable and disable without errors', () => {
    expect(() => {
      instrumentation.enable();
      instrumentation.disable();
    }).not.toThrow();
  });

  describe('as a LogRecordProcessor (onEmit — unit level)', () => {
    const makeMockRecord = () => {
      const attrs: Record<string, unknown> = {};
      return {
        record: {
          setAttribute(key: string, value: unknown) {
            attrs[key] = value;
            return this;
          },
        } as never,
        attrs,
      };
    };

    it('should set browser.document.url.full when enabled', () => {
      instrumentation.enable();

      const { record, attrs } = makeMockRecord();
      instrumentation.onEmit(record);

      expect(attrs[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(location.href);
    });

    it('should NOT set the attribute when disabled', () => {
      // disabled by default

      const { record, attrs } = makeMockRecord();
      instrumentation.onEmit(record);

      expect(attrs[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBeUndefined();
    });

    it('should use location.href as the attribute value', () => {
      instrumentation.enable();

      const { record, attrs } = makeMockRecord();
      instrumentation.onEmit(record);

      expect(attrs[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(location.href);
    });

    it('should resolve forceFlush immediately', async () => {
      await expect(instrumentation.forceFlush()).resolves.toBeUndefined();
    });

    it('should resolve shutdown immediately', async () => {
      await expect(instrumentation.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('as a LogRecordProcessor (pipeline — integration)', () => {
    it('should set browser.document.url.full on log records emitted through the global logger when enabled', () => {
      instrumentation.enable();

      const logger = logs.getLogger('test');
      logger.emit({ body: 'test event', eventName: 'test.event' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(1);
      expect(records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(
        location.href,
      );
    });

    it('should NOT set the attribute on log records when disabled', () => {
      // disabled by default

      const logger = logs.getLogger('test');
      logger.emit({ body: 'test event', eventName: 'test.event' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(1);
      expect(
        records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL],
      ).toBeUndefined();
    });

    it('should stop setting the attribute after disable()', () => {
      instrumentation.enable();

      const logger = logs.getLogger('test');
      logger.emit({ body: 'first event' });

      instrumentation.disable();
      logger.emit({ body: 'second event' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(2);
      expect(records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(
        location.href,
      );
      expect(
        records[1]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL],
      ).toBeUndefined();
    });

    it('should set the attribute on records from all loggers', () => {
      instrumentation.enable();

      logs.getLogger('scope-a').emit({ body: 'from a' });
      logs.getLogger('scope-b').emit({ body: 'from b' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(2);
      for (const record of records) {
        expect(record.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(
          location.href,
        );
      }
    });
  });

  describe('auto-injection via registerInstrumentations', () => {
    it('should not double-register when also passed as an explicit processor', () => {
      // The instrumentation is already in the processor list (from beforeAll).
      // registerInstrumentations calls setLoggerProvider, which should detect
      // it is already registered via the `includes` guard.
      const unregister = registerInstrumentations({
        instrumentations: [instrumentation],
      });

      instrumentation.enable();

      const logger = logs.getLogger('test');
      logger.emit({ body: 'single-stamp' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(1);
      expect(records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(
        location.href,
      );

      // Verify enable/disable state is controlled by registerInstrumentations
      unregister();
    });

    it('should enable on register and disable on deregister', () => {
      const inst = new BrowserDocumentUrlInstrumentation({ enabled: false });

      // Inject inst manually into the global provider's processor list.
      // This mimics what happens when it's passed to the provider config.
      const sharedState = (
        logs.getLoggerProvider() as {
          _sharedState?: {
            registeredLogRecordProcessors: (typeof instrumentation)[];
          };
        }
      )._sharedState;
      sharedState?.registeredLogRecordProcessors.push(inst);

      const unregister = registerInstrumentations({
        instrumentations: [inst],
      });

      // After register, instrumentation should be enabled.
      const logger = logs.getLogger('test');
      logger.emit({ body: 'after register' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(1);
      expect(records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(
        location.href,
      );

      exporter.reset();
      unregister();

      // After deregister, instrumentation is disabled.
      logger.emit({ body: 'after deregister' });
      const records2 = exporter.getFinishedLogRecords();
      expect(records2.length).toBe(1);
      expect(
        records2[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL],
      ).toBeUndefined();

      // Cleanup: remove inst from the provider's processor list.
      if (sharedState) {
        const idx = sharedState.registeredLogRecordProcessors.indexOf(inst);
        if (idx !== -1) {
          sharedState.registeredLogRecordProcessors.splice(idx, 1);
        }
      }
    });
  });

  describe('as a SpanProcessor', () => {
    const makeMockSpan = () => {
      const attributes: Record<string, unknown> = {};
      return {
        span: {
          setAttribute(key: string, value: unknown) {
            attributes[key] = value;
            return this;
          },
        } as never,
        attributes,
      };
    };

    it('should set browser.document.url.full on spans via onStart when enabled', () => {
      instrumentation.enable();

      const { span, attributes } = makeMockSpan();
      instrumentation.onStart(span, {} as never);

      expect(attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(location.href);
    });

    it('should NOT set the attribute on spans when disabled', () => {
      // disabled by default

      const { span, attributes } = makeMockSpan();
      instrumentation.onStart(span, {} as never);

      expect(attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBeUndefined();
    });

    it('should not throw on onEnd', () => {
      expect(() => instrumentation.onEnd({})).not.toThrow();
    });
  });
});

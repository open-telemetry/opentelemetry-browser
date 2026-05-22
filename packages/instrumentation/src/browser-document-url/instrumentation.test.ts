/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setupTestLogExporter } from '#utils/test';
import {
  BrowserDocumentUrlLogProcessor,
  BrowserDocumentUrlSpanProcessor,
} from './instrumentation.ts';
import { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';

describe('BrowserDocumentUrlLogProcessor', () => {
  /**
   * A single shared processor instance is passed to setupTestLogExporter once
   * per jsdom environment because logs.setGlobalLoggerProvider is a one-time
   * operation. Individual tests enable or disable it to exercise behavior.
   */
  let exporter: InMemoryLogRecordExporter;
  let processor: BrowserDocumentUrlLogProcessor;

  beforeAll(() => {
    processor = new BrowserDocumentUrlLogProcessor({ enabled: false });
    exporter = setupTestLogExporter([processor]);
  });

  beforeEach(() => {
    exporter.reset();
  });

  afterEach(() => {
    processor.disable();
  });

  it('should create an instance', () => {
    expect(processor).toBeInstanceOf(BrowserDocumentUrlLogProcessor);
  });

  it('should enable and disable without errors', () => {
    expect(() => {
      processor.enable();
      processor.disable();
    }).not.toThrow();
  });

  describe('onEmit (unit level)', () => {
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
      processor.enable();

      const { record, attrs } = makeMockRecord();
      processor.onEmit(record);

      expect(attrs[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(location.href);
    });

    it('should NOT set the attribute when disabled', () => {
      const { record, attrs } = makeMockRecord();
      processor.onEmit(record);

      expect(attrs[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBeUndefined();
    });

    it('should use location.href as the attribute value', () => {
      processor.enable();

      const { record, attrs } = makeMockRecord();
      processor.onEmit(record);

      expect(attrs[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(location.href);
    });

    it('should resolve forceFlush immediately', async () => {
      await expect(processor.forceFlush()).resolves.toBeUndefined();
    });

    it('should resolve shutdown immediately', async () => {
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('pipeline integration', () => {
    it('should set browser.document.url.full on log records when enabled', () => {
      processor.enable();

      logs
        .getLogger('test')
        .emit({ body: 'test event', eventName: 'test.event' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(1);
      expect(records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(
        location.href,
      );
    });

    it('should NOT set the attribute when disabled', () => {
      logs
        .getLogger('test')
        .emit({ body: 'test event', eventName: 'test.event' });

      const records = exporter.getFinishedLogRecords();
      expect(records.length).toBe(1);
      expect(
        records[0]?.attributes[ATTR_BROWSER_DOCUMENT_URL_FULL],
      ).toBeUndefined();
    });

    it('should stop setting the attribute after disable()', () => {
      processor.enable();

      const logger = logs.getLogger('test');
      logger.emit({ body: 'first event' });

      processor.disable();
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
      processor.enable();

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
});

describe('BrowserDocumentUrlSpanProcessor', () => {
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

  it('should create an instance', () => {
    expect(new BrowserDocumentUrlSpanProcessor()).toBeInstanceOf(
      BrowserDocumentUrlSpanProcessor,
    );
  });

  it('should enable and disable without errors', () => {
    const processor = new BrowserDocumentUrlSpanProcessor();
    expect(() => {
      processor.enable();
      processor.disable();
    }).not.toThrow();
  });

  it('should set browser.document.url.full on spans via onStart when enabled', () => {
    const processor = new BrowserDocumentUrlSpanProcessor();

    const { span, attributes } = makeMockSpan();
    processor.onStart(span, {} as never);

    expect(attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBe(location.href);
  });

  it('should NOT set the attribute when disabled', () => {
    const processor = new BrowserDocumentUrlSpanProcessor({ enabled: false });

    const { span, attributes } = makeMockSpan();
    processor.onStart(span, {} as never);

    expect(attributes[ATTR_BROWSER_DOCUMENT_URL_FULL]).toBeUndefined();
  });

  it('should not throw on onEnd', () => {
    const processor = new BrowserDocumentUrlSpanProcessor();
    expect(() => processor.onEnd({} as never)).not.toThrow();
  });

  it('should resolve forceFlush immediately', async () => {
    const processor = new BrowserDocumentUrlSpanProcessor();
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });

  it('should resolve shutdown immediately', async () => {
    const processor = new BrowserDocumentUrlSpanProcessor();
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});

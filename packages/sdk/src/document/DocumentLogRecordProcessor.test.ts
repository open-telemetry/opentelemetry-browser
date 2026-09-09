/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { describe, expect, it } from 'vitest';
import { DocumentLogRecordProcessor } from './DocumentLogRecordProcessor.ts';

const DOCUMENT_URL = 'https://example.com/checkout?step=2';

describe('DocumentLogRecordProcessor', () => {
  it('adds browser.document.url.full attribute', () => {
    const expectedAttributes = {
      'browser.document.url.full': DOCUMENT_URL,
    };

    const documentProvider = {
      getDocumentUrl: () => DOCUMENT_URL,
    };

    const exporter = new InMemoryLogRecordExporter();
    const processor = new DocumentLogRecordProcessor(documentProvider);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('document-testing');
    logger.emit({ body: 'test-body' });

    const logRecord = exporter.getFinishedLogRecords()[0];
    expect(logRecord?.attributes).toEqual(expectedAttributes);
  });

  it('does not add the attribute when the document URL is unavailable', () => {
    const documentProvider = {
      getDocumentUrl: () => null,
    };

    const exporter = new InMemoryLogRecordExporter();
    const processor = new DocumentLogRecordProcessor(documentProvider);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('document-testing');
    logger.emit({ body: 'test-body' });

    const logRecord = exporter.getFinishedLogRecords()[0];
    expect(logRecord?.attributes).toEqual({});
  });

  it('does not add the attribute when there is no provider', () => {
    const exporter = new InMemoryLogRecordExporter();
    // biome-ignore lint/suspicious/noExplicitAny: testing missing provider
    const processor = new DocumentLogRecordProcessor(null as any);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('document-testing');
    logger.emit({ body: 'test-body' });

    const logRecord = exporter.getFinishedLogRecords()[0];
    expect(logRecord?.attributes).toEqual({});
  });

  it('captures the document URL at emit time', () => {
    let currentUrl = 'https://example.com/page-a';

    const documentProvider = {
      getDocumentUrl: () => currentUrl,
    };

    const exporter = new InMemoryLogRecordExporter();
    const processor = new DocumentLogRecordProcessor(documentProvider);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('document-testing');
    logger.emit({ body: 'on-page-a' });

    currentUrl = 'https://example.com/page-b';
    logger.emit({ body: 'on-page-b' });

    const logRecords = exporter.getFinishedLogRecords();
    expect(logRecords[0]?.attributes).toEqual({
      'browser.document.url.full': 'https://example.com/page-a',
    });
    expect(logRecords[1]?.attributes).toEqual({
      'browser.document.url.full': 'https://example.com/page-b',
    });
  });

  it('forceFlush is a no-op and does not throw error', async () => {
    const processor = new DocumentLogRecordProcessor({
      getDocumentUrl: () => null,
    });
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });

  it('shutdown is a no-op and does not throw error', async () => {
    const processor = new DocumentLogRecordProcessor({
      getDocumentUrl: () => null,
    });
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});

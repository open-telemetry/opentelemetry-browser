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
import { SessionLogRecordProcessor } from './SessionLogRecordProcessor.ts';

describe('SessionLogRecordProcessor', () => {
  it('adds session.id attribute', () => {
    const expectedAttributes = {
      'session.id': '12345678',
    };

    const sessionProvider = {
      getSessionId: () => '12345678',
    };

    const exporter = new InMemoryLogRecordExporter();
    const processor = new SessionLogRecordProcessor(sessionProvider);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('session-testing');
    logger.emit({ body: 'test-body' });

    const logRecord = exporter.getFinishedLogRecords()[0];
    expect(logRecord?.attributes).toEqual(expectedAttributes);
  });

  it('does not add session.id attribute when there is no session', () => {
    const sessionProvider = {
      getSessionId: () => null,
    };

    const exporter = new InMemoryLogRecordExporter();
    const processor = new SessionLogRecordProcessor(sessionProvider);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('session-testing');
    logger.emit({ body: 'test-body' });

    const logRecord = exporter.getFinishedLogRecords()[0];
    expect(logRecord?.attributes).toEqual({});
  });

  it('does not add session.id attribute when there is no provider', () => {
    const exporter = new InMemoryLogRecordExporter();
    // biome-ignore lint/suspicious/noExplicitAny: testing missing provider
    const processor = new SessionLogRecordProcessor(null as any);
    const provider = new LoggerProvider({
      processors: [processor, new SimpleLogRecordProcessor({ exporter })],
    });

    const logger = provider.getLogger('session-testing');
    logger.emit({ body: 'test-body' });

    const logRecord = exporter.getFinishedLogRecords()[0];
    expect(logRecord?.attributes).toEqual({});
  });

  it('forceFlush is a no-op and does not throw error', async () => {
    const processor = new SessionLogRecordProcessor({
      getSessionId: () => null,
    });
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });

  it('shutdown is a no-op and does not throw error', async () => {
    const processor = new SessionLogRecordProcessor({
      getSessionId: () => null,
    });
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});

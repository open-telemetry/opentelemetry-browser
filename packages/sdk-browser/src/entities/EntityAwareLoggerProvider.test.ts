/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  InMemoryLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Entity } from './Entity.ts';
import { EntityAwareLoggerProvider } from './EntityAwareLoggerProvider.ts';

const sessionEntity = (id: string): Entity => ({
  type: 'browser.session',
  identifier: { 'session.id': id },
});

const documentEntity = (href: string): Entity => ({
  type: 'browser.document',
  identifier: { 'browser.document.url.full': href },
});

describe('EntityAwareLoggerProvider', () => {
  let exporter: InMemoryLogRecordExporter;
  let processor: SimpleLogRecordProcessor;
  let provider: EntityAwareLoggerProvider;

  beforeEach(() => {
    exporter = new InMemoryLogRecordExporter();
    processor = new SimpleLogRecordProcessor(exporter);
    provider = new EntityAwareLoggerProvider({
      resource: resourceFromAttributes({ 'service.name': 'test' }),
      processors: [processor],
    });
  });

  const emit = (logger: ReturnType<typeof provider.getLogger>, body: string) =>
    logger.emit({ body, severityNumber: SeverityNumber.INFO });

  it('stamps current entity attributes onto emitted records', () => {
    const logger = provider.getLogger('test');
    provider.setEntity(sessionEntity('s1'));
    emit(logger, 'hello');

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.resource.attributes).toMatchObject({
      'service.name': 'test',
      'session.id': 's1',
    });
  });

  it('routes records emitted before setEntity through the bare base resource', () => {
    const logger = provider.getLogger('test');
    emit(logger, 'before-entity');

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]?.resource.attributes['session.id']).toBeUndefined();
    expect(records[0]?.resource.attributes['service.name']).toBe('test');
  });

  it('rebinds an already-obtained logger to new entity values', () => {
    const logger = provider.getLogger('test');
    provider.setEntity(sessionEntity('s1'));
    emit(logger, 'first');
    provider.setEntity(sessionEntity('s2'));
    emit(logger, 'second');

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(2);
    expect(records[0]?.resource.attributes['session.id']).toBe('s1');
    expect(records[1]?.resource.attributes['session.id']).toBe('s2');
  });

  it('combines multiple entities of different types', () => {
    const logger = provider.getLogger('test');
    provider.setEntity(sessionEntity('s1'));
    provider.setEntity(documentEntity('https://example.com/a'));
    emit(logger, 'combined');

    const records = exporter.getFinishedLogRecords();
    expect(records[0]?.resource.attributes).toMatchObject({
      'session.id': 's1',
      'browser.document.url.full': 'https://example.com/a',
    });
  });

  it('updates one entity without affecting another', () => {
    const logger = provider.getLogger('test');
    provider.setEntity(sessionEntity('s1'));
    provider.setEntity(documentEntity('https://example.com/a'));
    emit(logger, 'first');

    provider.setEntity(documentEntity('https://example.com/b'));
    emit(logger, 'second');

    const records = exporter.getFinishedLogRecords();
    expect(records[1]?.resource.attributes['session.id']).toBe('s1');
    expect(records[1]?.resource.attributes['browser.document.url.full']).toBe(
      'https://example.com/b',
    );
  });

  it('drops entity attributes when removeEntity is called', () => {
    const logger = provider.getLogger('test');
    provider.setEntity(sessionEntity('s1'));
    provider.removeEntity('browser.session');
    emit(logger, 'after-remove');

    const records = exporter.getFinishedLogRecords();
    expect(records[0]?.resource.attributes['session.id']).toBeUndefined();
  });

  it('does not duplicate emissions across rebuilds (single processor instance)', () => {
    const logger = provider.getLogger('test');
    provider.setEntity(sessionEntity('s1'));
    provider.setEntity(sessionEntity('s2'));
    provider.setEntity(sessionEntity('s3'));
    emit(logger, 'once');

    const records = exporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
  });
});

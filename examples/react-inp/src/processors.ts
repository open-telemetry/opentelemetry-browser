/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LogRecordExporter,
  LogRecordProcessor,
  ReadWriteLogRecord,
} from '@opentelemetry/sdk-logs';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { InpBlameLogRecordProcessor } from 'react-inp-blame/otel';

const SAFE_FIELDS = new Set([
  'status',
  'blame.kind',
  'blame.ms',
  'blame.confidence',
  'react_status',
  'react_build',
  'commits.count',
  'commits.rendered',
  'commits.ms',
  'follow_ups.count',
  'follow_ups.ms',
]);

export class InpPrivacyProcessor implements LogRecordProcessor {
  private readonly includeNames: boolean;

  constructor(includeNames = false) {
    this.includeNames = includeNames;
  }

  onEmit(record: ReadWriteLogRecord): void {
    if (
      this.includeNames ||
      String(record.attributes['browser.web_vital.name']).toLowerCase() !==
        'inp'
    ) {
      return;
    }
    for (const key of Object.keys(record.attributes)) {
      if (
        key.startsWith('react_inp_blame.') &&
        !SAFE_FIELDS.has(key.slice('react_inp_blame.'.length))
      ) {
        delete record.attributes[key];
      }
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export function createLogProcessors(
  exporter: LogRecordExporter,
  includeNames = false,
): LogRecordProcessor[] {
  return [
    new InpBlameLogRecordProcessor(),
    new InpPrivacyProcessor(includeNames),
    new BatchLogRecordProcessor({ exporter, scheduledDelayMillis: 1000 }),
  ];
}

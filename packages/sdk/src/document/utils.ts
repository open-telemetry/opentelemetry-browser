/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecordProcessor } from '@opentelemetry/sdk-logs';
import type { SpanProcessor } from '@opentelemetry/sdk-trace';
import { DocumentLogRecordProcessor } from './DocumentLogRecordProcessor.ts';
import { DocumentSpanProcessor } from './DocumentSpanProcessor.ts';
import type { DocumentProvider } from './types/DocumentProvider.ts';

export function createDocumentSpanProcessor(
  documentProvider: DocumentProvider,
): SpanProcessor {
  return new DocumentSpanProcessor(documentProvider);
}

export function createDocumentLogRecordProcessor(
  documentProvider: DocumentProvider,
): LogRecordProcessor {
  return new DocumentLogRecordProcessor(documentProvider);
}

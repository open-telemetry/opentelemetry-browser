/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
import { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';
import type { DocumentProvider } from './types/DocumentProvider.ts';

/**
 * DocumentLogRecordProcessor is a {@link LogRecordProcessor} that adds the
 * browser.document.url.full attribute
 */
export class DocumentLogRecordProcessor implements LogRecordProcessor {
  private _documentProvider: DocumentProvider;

  constructor(documentProvider: DocumentProvider) {
    this._documentProvider = documentProvider;
  }

  onEmit(logRecord: SdkLogRecord, _context?: Context | undefined): void {
    const documentUrl = this._documentProvider?.getDocumentUrl();
    if (documentUrl) {
      logRecord.setAttribute(ATTR_BROWSER_DOCUMENT_URL_FULL, documentUrl);
    }
  }

  /**
   * Forces to export all finished log records
   */
  async forceFlush(): Promise<void> {}

  /**
   * Shuts down the processor. Called when SDK is shut down. This is an
   * opportunity for processor to do any cleanup required.
   */
  async shutdown(): Promise<void> {}
}

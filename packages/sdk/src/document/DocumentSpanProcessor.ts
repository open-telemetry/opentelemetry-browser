/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from '@opentelemetry/sdk-trace';
import { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';
import type { DocumentProvider } from './types/DocumentProvider.ts';

/**
 * DocumentSpanProcessor is a {@link SpanProcessor} that adds the
 * browser.document.url.full attribute
 */
export class DocumentSpanProcessor implements SpanProcessor {
  private _documentProvider: DocumentProvider;

  constructor(documentProvider: DocumentProvider) {
    this._documentProvider = documentProvider;
  }

  /**
   * Forces to export all finished spans
   */
  async forceFlush(): Promise<void> {}

  /**
   * Called when a {@link Span} is started, if the `span.isRecording()`
   * returns true. The document URL is captured here, so a span that outlives
   * a soft navigation keeps the URL of the page it started on.
   *
   * TODO: we may need the URL at `onEnd` instead, or both.
   *
   * @param span the Span that just started.
   */
  onStart(span: Span, _parentContext: Context): void {
    const documentUrl = this._documentProvider?.getDocumentUrl();
    if (documentUrl) {
      span.setAttribute(ATTR_BROWSER_DOCUMENT_URL_FULL, documentUrl);
    }
  }

  /**
   * Called when a {@link ReadableSpan} is ended, if the `span.isRecording()`
   * returns true.
   * @param span the Span that just ended.
   */
  onEnd(_: ReadableSpan): void {
    // no-op
  }

  /**
   * Shuts down the processor. Called when SDK is shut down. This is an
   * opportunity for processor to do any cleanup required.
   */
  async shutdown(): Promise<void> {}
}

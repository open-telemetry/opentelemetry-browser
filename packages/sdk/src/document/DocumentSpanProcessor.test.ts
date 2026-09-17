/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ROOT_CONTEXT } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/sdk-trace';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { describe, expect, it } from 'vitest';
import { DocumentSpanProcessor } from './DocumentSpanProcessor.ts';

const DOCUMENT_URL = 'https://example.com/checkout?step=2';

describe('DocumentSpanProcessor', () => {
  it('adds browser.document.url.full attribute', () => {
    const expectedAttributes = {
      'browser.document.url.full': DOCUMENT_URL,
    };

    const tracer = new TracerProvider().getTracer('document-testing');
    const span = tracer.startSpan('test-span') as Span;

    const documentProvider = {
      getDocumentUrl: () => DOCUMENT_URL,
    };

    const processor = new DocumentSpanProcessor(documentProvider);
    processor.onStart(span, ROOT_CONTEXT);

    expect(span.attributes).toEqual(expectedAttributes);
  });

  it('does not add the attribute when the document URL is unavailable', () => {
    const tracer = new TracerProvider().getTracer('document-testing');
    const span = tracer.startSpan('test-span') as Span;

    const documentProvider = {
      getDocumentUrl: () => null,
    };

    const processor = new DocumentSpanProcessor(documentProvider);
    processor.onStart(span, ROOT_CONTEXT);

    expect(span.attributes).toEqual({});
  });

  it('does not add the attribute when there is no provider', () => {
    const tracer = new TracerProvider().getTracer('document-testing');
    const span = tracer.startSpan('test-span') as Span;

    // biome-ignore lint/suspicious/noExplicitAny: testing missing provider
    const processor = new DocumentSpanProcessor(null as any);
    processor.onStart(span, ROOT_CONTEXT);

    expect(span.attributes).toEqual({});
  });

  it('captures the document URL at span start, not at span end', () => {
    let currentUrl = 'https://example.com/page-a';

    const documentProvider = {
      getDocumentUrl: () => currentUrl,
    };

    const tracer = new TracerProvider().getTracer('document-testing');
    const processor = new DocumentSpanProcessor(documentProvider);

    const span = tracer.startSpan('test-span') as Span;
    processor.onStart(span, ROOT_CONTEXT);

    // A soft navigation while the span is in flight must not change it.
    currentUrl = 'https://example.com/page-b';
    processor.onEnd(span);

    expect(span.attributes).toEqual({
      'browser.document.url.full': 'https://example.com/page-a',
    });
  });

  it('forceFlush is a no-op and does not throw error', async () => {
    const processor = new DocumentSpanProcessor({
      getDocumentUrl: () => null,
    });
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });

  it('onEnd is a no-op and does not throw error', () => {
    const tracer = new TracerProvider().getTracer('document-testing');
    const span = tracer.startSpan('test-span') as Span;

    const processor = new DocumentSpanProcessor({
      getDocumentUrl: () => null,
    });

    expect(() => processor.onEnd(span)).not.toThrow();
  });

  it('shutdown is a no-op and does not throw error', async () => {
    const processor = new DocumentSpanProcessor({
      getDocumentUrl: () => null,
    });
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});

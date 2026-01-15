/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { getTraceParent, getTraceParentString } from './getTraceParent.ts';

describe('getTraceParent utilities', () => {
  let metaElement: HTMLMetaElement | null = null;

  afterEach(() => {
    if (metaElement) {
      metaElement.remove();
      metaElement = null;
    }
  });

  function addMetaTag(content: string): void {
    metaElement = document.createElement('meta');
    metaElement.setAttribute('name', 'traceparent');
    metaElement.content = content;
    document.head.appendChild(metaElement);
  }

  describe('getTraceParentString', () => {
    it('should return empty string when no traceparent meta tag exists', () => {
      const result = getTraceParentString();
      expect(result).toBe('');
    });

    it('should return the traceparent content when meta tag exists', () => {
      const traceparent =
        '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      addMetaTag(traceparent);

      const result = getTraceParentString();
      expect(result).toBe(traceparent);
    });
  });

  describe('getTraceParent', () => {
    it('should return null when no traceparent meta tag exists', () => {
      const result = getTraceParent();
      expect(result).toBeNull();
    });

    it('should return null for invalid traceparent', () => {
      addMetaTag('invalid-traceparent');

      const result = getTraceParent();
      expect(result).toBeNull();
    });

    it('should return parsed SpanContext for valid traceparent', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c';
      const spanId = 'b7ad6b7169203331';
      addMetaTag(`00-${traceId}-${spanId}-01`);

      const result = getTraceParent();
      expect(result).not.toBeNull();
      expect(result?.traceId).toBe(traceId);
      expect(result?.spanId).toBe(spanId);
      expect(result?.traceFlags).toBe(1);
    });

    it('should handle traceparent with traceFlags 00', () => {
      const traceId = '0af7651916cd43dd8448eb211c80319c';
      const spanId = 'b7ad6b7169203331';
      addMetaTag(`00-${traceId}-${spanId}-00`);

      const result = getTraceParent();
      expect(result).not.toBeNull();
      expect(result?.traceFlags).toBe(0);
    });
  });
});

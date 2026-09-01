/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * ElementTimingInstrumentation Configuration
 */
export interface ElementTimingInstrumentationConfig
  extends InstrumentationConfig {
  // Configuration options will be added here
}

/**
 * A PerformanceEntry produced by the Element Timing API.
 * Not yet part of the TypeScript DOM lib (checked against TypeScript 6.0).
 * @see https://w3c.github.io/element-timing/#sec-performance-element-timing
 */
export type PerformanceElementTiming = PerformanceEntry & {
  readonly entryType: 'element';
  readonly name: 'image-paint' | 'text-paint';
  readonly identifier: string;
  readonly element: Element | null;
  readonly renderTime: DOMHighResTimeStamp;
  /** Always 0 for `text-paint` entries. */
  readonly loadTime: DOMHighResTimeStamp;
  /** Always the empty string for `text-paint` entries. */
  readonly url: string;
  /** Always 0 for `text-paint` entries. */
  readonly naturalWidth: number;
  /** Always 0 for `text-paint` entries. */
  readonly naturalHeight: number;
};

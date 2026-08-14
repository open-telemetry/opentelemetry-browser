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
 * Not yet part of the TypeScript DOM lib.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/PerformanceElementTiming
 */
export type PerformanceElementTiming = PerformanceEntry & {
  identifier: string;
  element: Element | null;
  renderTime: number;
  loadTime: number;
  url: string;
  naturalWidth: number;
  naturalHeight: number;
};

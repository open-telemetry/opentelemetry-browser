/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * ResourceTimingInstrumentation Configuration
 */
export interface ResourceTimingInstrumentationConfig
  extends InstrumentationConfig {
  /**
   * Number of resources to process per batch.
   * Default: 50
   */
  batchSize?: number;

  /**
   * Maximum time in milliseconds to wait for an idle callback before forcing processing.
   * Default: 1000
   */
  forceProcessingAfter?: number;

  /**
   * Maximum time in milliseconds to spend processing resources per idle callback.
   * Default: 50
   */
  maxProcessingTime?: number;

  /**
   * Maximum number of resources to queue before forcing immediate flush.
   * Default: 1000
   */
  maxQueueSize?: number;
}

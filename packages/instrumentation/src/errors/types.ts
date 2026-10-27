/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';

export type ApplyCustomAttributesFunction = (
  error: Error | string,
) => Attributes;

/**
 * ErrorsInstrumentation Configuration
 */
export interface ErrorsInstrumentationConfig {
  /**
   * Optional callback invoked for each captured error or unhandled rejection.
   * Returned attributes are merged onto the emitted log record (after the
   * standard `exception.*` attributes, so they may override them).
   */
  applyCustomAttributes?: ApplyCustomAttributesFunction;
}

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';

export type ApplyCustomAttributesFunction = (
  error: Error | string,
  originalError: unknown,
) => Attributes;

/**
 * ErrorsInstrumentation Configuration
 */
export interface ErrorsInstrumentationConfig {
  /**
   * Optional callback invoked with the normalized error and the original thrown
   * value or rejection reason.
   * Returned attributes are merged onto the emitted log record (after the
   * standard `exception.*` attributes, so they may override them).
   */
  applyCustomAttributes?: ApplyCustomAttributesFunction;
}

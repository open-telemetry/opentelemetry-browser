/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TextMapPropagator } from '@opentelemetry/api';
import {
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';

/**
 * Returns the default propagators:
 * - W3CTraceContextPropagator
 * - W3CBaggagePropagator
 * @returns {TextMapPropagator}
 */
export function getDefaultPropagators(): TextMapPropagator[] {
  return [new W3CTraceContextPropagator(), new W3CBaggagePropagator()];
}

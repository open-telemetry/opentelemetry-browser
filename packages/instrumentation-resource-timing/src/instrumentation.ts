/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { InstrumentationBase } from '@opentelemetry/instrumentation';
import type { ResourceTimingInstrumentationConfig } from './types.ts';

/**
 * OpenTelemetry instrumentation for resource timing for browser applications.
 */
export class ResourceTimingInstrumentation extends InstrumentationBase<ResourceTimingInstrumentationConfig> {
  constructor(config: ResourceTimingInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-resource-timing', '0.1.0', config);
  }

  protected override init() {
    // TODO: Implement instrumentation logic
    return [];
  }

  override enable(): void {
    // TODO: Implement enable logic
  }

  override disable(): void {
    // TODO: Implement disable logic
  }
}

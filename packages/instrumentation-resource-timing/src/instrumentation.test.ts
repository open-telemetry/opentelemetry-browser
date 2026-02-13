/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResourceTimingInstrumentation } from './instrumentation.ts';

describe('ResourceTimingInstrumentation', () => {
  let instrumentation: ResourceTimingInstrumentation;

  beforeEach(() => {
    instrumentation = new ResourceTimingInstrumentation();
    instrumentation.enable();
  });

  afterEach(() => {
    instrumentation.disable();
  });

  it('should be defined', () => {
    expect(instrumentation).toBeDefined();
  });
});

/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { setupTestLogExporter } from '@opentelemetry/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NavigationTimingInstrumentation } from './instrumentation';

describe('NavigationTimingInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: NavigationTimingInstrumentation;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    instrumentation = new NavigationTimingInstrumentation();

    instrumentation.enable();
  });

  afterEach(() => {
    instrumentation.disable();
    inMemoryExporter.reset();
    document.body.innerHTML = '';
  });

  it('should create an instance of NavigationTimingInstrumentation', () => {
    expect(instrumentation).toBeInstanceOf(NavigationTimingInstrumentation);
  });

  it('should enable and disable without errors', () => {
    expect(() => {
      instrumentation.enable();
      instrumentation.disable();
    }).not.toThrow();
  });

  // TODO: Add navigation timing specific tests
});

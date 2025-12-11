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

import { InstrumentationBase } from '@opentelemetry/instrumentation';
import type { NavigationTimingInstrumentationConfig } from './types';

/**
 * This class automatically instruments navigation timing within the browser.
 */
export class NavigationTimingInstrumentation extends InstrumentationBase<NavigationTimingInstrumentationConfig> {
  constructor(config: NavigationTimingInstrumentationConfig = {}) {
    super(
      '@opentelemetry/instrumentation-navigation-timing',
      '0.1.0',
      config,
    );
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    // TODO: Implement navigation timing instrumentation
  }

  override disable(): void {
    // TODO: Implement cleanup for navigation timing instrumentation
  }
}

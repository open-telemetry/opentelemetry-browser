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

import path from 'node:path';
import { mergeConfig } from 'vite';
import rootConfig from '../../vitest.config';

export default mergeConfig(rootConfig, {
  resolve: {
    alias: {
      '@opentelemetry/web-utils': path.resolve(__dirname, '../web-utils/src'),
    },
  },
});

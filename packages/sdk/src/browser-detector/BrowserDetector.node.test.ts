/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { browserDetector } from '@opentelemetry/browser-sdk/browser-detector';

describe('browserDetector outside a browser', () => {
  it('returns an empty resource', () => {
    expect(browserDetector.detect().attributes).toEqual({});
  });
});

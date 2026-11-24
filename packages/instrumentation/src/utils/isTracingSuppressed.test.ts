/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ROOT_CONTEXT } from '@opentelemetry/api';
import { suppressTracing, unsuppressTracing } from '@opentelemetry/core';
import { describe, expect, it } from 'vitest';
import { isTracingSuppressed } from './isTracingSuppressed.ts';

describe('isTracingSuppressed', () => {
  it('is false for a context without the mark', () => {
    expect(isTracingSuppressed(ROOT_CONTEXT)).toBe(false);
  });

  it('is true for a context marked by suppressTracing() from core', () => {
    expect(isTracingSuppressed(suppressTracing(ROOT_CONTEXT))).toBe(true);
  });

  it('is false after unsuppressTracing() from core', () => {
    const ctx = unsuppressTracing(suppressTracing(ROOT_CONTEXT));

    expect(isTracingSuppressed(ctx)).toBe(false);
  });
});

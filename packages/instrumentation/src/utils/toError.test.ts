/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { toError } from './toError.ts';

describe('toError', () => {
  it('returns an Error unchanged', () => {
    const error = new TypeError('bad');

    expect(toError(error)).toBe(error);
  });

  it('wraps a primitive and keeps it as the cause', () => {
    const error = toError(42);

    expect(error.message).toBe('42');
    expect(error.cause).toBe(42);
  });

  it('wraps a value String() cannot convert', () => {
    const value = Object.create(null);

    const error = toError(value);

    expect(error.message).toBe('[object Object]');
    expect(error.cause).toBe(value);
  });

  it('does not throw for a revoked Proxy', () => {
    // `instanceof` and both string conversions throw on a revoked Proxy.
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    const error = toError(proxy);

    expect(error).toBeInstanceOf(Error);
    expect(error.cause).toBe(proxy);
  });
});

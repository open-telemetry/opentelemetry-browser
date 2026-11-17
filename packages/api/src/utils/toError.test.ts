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
    expect(error.message).toBe('thrown value could not be described');
    expect(error.cause).toBe(proxy);
  });

  it.each([null, undefined])('wraps %s and keeps it as the cause', (value) => {
    const error = toError(value);

    expect(error.message).toBe(String(value));
    expect(error.cause).toBe(value);
  });

  it('wraps an object whose toString throws', () => {
    const value = {
      toString() {
        throw new Error('no');
      },
    };

    const error = toError(value);

    expect(error.message).toBe('[object Object]');
    expect(error.cause).toBe(value);
  });
});

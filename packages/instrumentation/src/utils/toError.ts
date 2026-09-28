/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes any thrown value to an `Error`, keeping a non-Error value as
 * `cause`. Never throws, because a throw here would replace the error we are
 * trying to report.
 */
export function toError(value: unknown): Error {
  try {
    if (value instanceof Error) {
      return value;
    }
    return new Error(describe(value), { cause: value });
  } catch {
    // A revoked Proxy throws on `instanceof` and on both conversions below.
    return new Error('thrown value could not be described', { cause: value });
  }
}

function describe(value: unknown): string {
  try {
    return String(value);
  } catch {
    // `String()` throws on values like `Object.create(null)`.
    return Object.prototype.toString.call(value);
  }
}

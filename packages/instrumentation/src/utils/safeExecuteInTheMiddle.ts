/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Runs `execute`, then always invokes `onFinish` with the thrown error (if any)
 * and the result. Rethrows the error unless `preventThrow` is `true`.
 *
 * Browser-local copy of the helper of the same name from
 * `@opentelemetry/instrumentation`, kept here so this package does not depend on
 * that package's runtime.
 */
export function safeExecuteInTheMiddle<T>(
  execute: () => T,
  onFinish: (error: Error | undefined, result: T | undefined) => void,
  preventThrow?: boolean,
): T {
  let error: Error | undefined;
  let result: T | undefined;
  try {
    result = execute();
  } catch (e) {
    error = e as Error;
  }
  onFinish(error, result);
  if (error && preventThrow !== true) {
    throw error;
  }
  return result as T;
}

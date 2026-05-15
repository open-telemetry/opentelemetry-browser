/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export function urlMatches(url: string, pattern: string | RegExp): boolean {
  return typeof pattern === 'string' ? url === pattern : pattern.test(url);
}

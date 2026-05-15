/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const KNOWN_METHODS: Record<string, boolean> = {
  CONNECT: true,
  DELETE: true,
  GET: true,
  HEAD: true,
  OPTIONS: true,
  PATCH: true,
  POST: true,
  PUT: true,
  QUERY: true,
  TRACE: true,
};

export function normalizeHttpRequestMethod(method: string): string {
  return method.toUpperCase() in KNOWN_METHODS
    ? method.toUpperCase()
    : '_OTHER';
}

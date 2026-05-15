/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export function parseUrl(url: string): URL {
  return new URL(url, document.baseURI);
}

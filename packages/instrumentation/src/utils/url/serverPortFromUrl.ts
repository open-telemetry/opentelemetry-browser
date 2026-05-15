/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const DEFAULT_PORT: Record<string, string> = {
  'https:': '443',
  'http:': '80',
};

export function serverPortFromUrl(url: URL): number | undefined {
  const port = Number(url.port || DEFAULT_PORT[url.protocol]);
  return port && !Number.isNaN(port) ? port : undefined;
}

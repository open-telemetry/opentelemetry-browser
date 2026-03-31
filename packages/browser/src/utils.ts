/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const DEFAULT_OTLP_ENDOINT = 'http://localhost:4318';

export function getExportUrl(
  signalUrl: string | undefined,
  genericUrl: string | undefined,
  signalPath: string,
) {
  if (typeof signalUrl === 'string') {
    return signalUrl;
  }

  const baseUrl =
    typeof genericUrl === 'string' ? genericUrl : DEFAULT_OTLP_ENDOINT;
  const url = new URL(signalPath, baseUrl);
  return url.href;
}

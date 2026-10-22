/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { ConsoleLogRecordExporter } from '@opentelemetry/sdk-logs';
import { createLogProcessors } from './processors.ts';

export function startTelemetry() {
  const url = import.meta.env['VITE_OTLP_LOGS_URL'];
  const exporter = url
    ? new OTLPLogExporter({ url })
    : new ConsoleLogRecordExporter();

  return startBrowserSdk({
    serviceName: 'react-inp-example',
    instrumentations: [
      new WebVitalsInstrumentation({ includeRawAttribution: false }),
    ],
    logs: {
      // Pinned SDK omits automatic export here. See README and browser #376.
      processors: createLogProcessors(
        exporter,
        import.meta.env['VITE_INP_INCLUDE_NAMES'] === 'true',
      ),
    },
  });
}

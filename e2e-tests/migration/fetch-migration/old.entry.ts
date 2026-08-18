/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import {
  StackContextManager,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import { COLLECTOR_URL } from '../../utils/test-collector.ts';
import { runScenario } from './scenarios.ts';

const provider = new WebTracerProvider({
  spanProcessors: [
    new SimpleSpanProcessor({
      exporter: new OTLPTraceExporter({ url: COLLECTOR_URL }),
    }),
  ],
});
provider.register({
  contextManager: new StackContextManager(),
  propagator: new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
  }),
});

registerInstrumentations({ instrumentations: [new FetchInstrumentation()] });

window.__fetchMigrationHarness = { runScenario };
window.__fetchMigrationReady = true;

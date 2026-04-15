/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { defaultResource } from '@opentelemetry/resources';
import type {
  GlobalConfig,
  LogsConfig,
  TracesConfig,
  WebSdk,
  WebSdkFactory,
} from './types.ts';

interface SdkFactories {
  logs?: WebSdkFactory<LogsConfig>;
  traces?: WebSdkFactory<TracesConfig>;
}

type ConfigsFor<T> = Partial<{
  [K in keyof T]: T[K] extends WebSdkFactory<infer C> ? C : never;
}>;

const DEFAULT_OTLP_ENDOINT = 'http://localhost:4318';

export function combineSdks<T extends SdkFactories>(
  factories: T,
): WebSdkFactory<ConfigsFor<T>> {
  // The returned function will transform some of the global
  // configuration options to signal specific ones if the SDK is available
  return function startSdk(config?: ConfigsFor<T>) {
    // Check the global config and set defaults
    const globalConfig = (config || {}) as GlobalConfig;
    globalConfig.otlpEndpoint ??= DEFAULT_OTLP_ENDOINT;

    // TODO: accept resource detectors?
    globalConfig.resource ??= defaultResource();

    const sdks: WebSdk[] = [];
    const otlpUrl = new URL(globalConfig.otlpEndpoint);

    // Start logs
    if (factories.logs) {
      const logsConfig = (config?.logs || {}) as LogsConfig;
      if (!logsConfig.otlpLogsEndpoint) {
        otlpUrl.pathname = 'v1/logs';
        logsConfig.otlpLogsEndpoint = otlpUrl.href;
      }
      logsConfig.otlpLogsHeaders ??= globalConfig.otlpHeaders;
      logsConfig.resource ??= globalConfig.resource;
      sdks.push(factories.logs(logsConfig));
    }

    // Start traces
    if (factories.traces) {
      const tracesConfig = (config?.traces || {}) as TracesConfig;
      if (!tracesConfig.otlpTracesEndpoint) {
        otlpUrl.pathname = '/v1/traces';
        tracesConfig.otlpTracesEndpoint = otlpUrl.href;
      }
      tracesConfig.otlpTracesHeaders ??= globalConfig.otlpHeaders;
      tracesConfig.resource ??= globalConfig.resource;
      sdks.push(factories.traces(tracesConfig));
    }

    return {
      shutdown() {
        return Promise.allSettled(sdks.map((s) => s.shutdown())).then(() => undefined);
      },
    };
  };
}

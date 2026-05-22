/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { defaultResource } from '@opentelemetry/resources';
import { startLogsSdk } from './logs.ts';
import { startTracesSdk } from './traces.ts';
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

/**
 * Combines different SDK factory functions into a single one
 * which accepts a global configuration along
 */
function combineSdks<T extends SdkFactories>(
  factories: T,
): WebSdkFactory<GlobalConfig & ConfigsFor<T>> {
  // The returned function will transform some of the global
  // configuration options to signal specific ones if the SDK is available
  return function startSdk(config?: GlobalConfig & ConfigsFor<T>) {
    // Check the global config and set defaults
    const globalConfig = (config || {}) as GlobalConfig;

    // Export
    globalConfig.exportConfig = Object.assign(
      { endpoint: DEFAULT_OTLP_ENDOINT },
      globalConfig.exportConfig,
    );

    // TODO: accept resource detectors?
    globalConfig.resource ??= defaultResource();

    const sdks: WebSdk[] = [];
    const endpointUrl = new URL(globalConfig.exportConfig!.url!);

    // Start logs
    if (factories.logs) {
      const logsConfig = (config?.logs || {}) as LogsConfig;
      const isGenericEndpoint = !logsConfig.exportConfig?.url;

      // Merge export configs
      logsConfig.exportConfig = Object.assign(
        {},
        globalConfig.exportConfig,
        logsConfig.exportConfig,
      );
      // Set the path if endpoint comes from general config
      if (isGenericEndpoint) {
        endpointUrl.pathname = '/v1/logs';
        logsConfig.exportConfig.url = endpointUrl.href;
      }
      logsConfig.resource ??= globalConfig.resource;
      sdks.push(factories.logs(logsConfig));
    }

    // Start traces
    if (factories.traces) {
      const tracesConfig = (config?.traces || {}) as TracesConfig;
      const isGenericEndpoint = !tracesConfig.exportConfig?.url;

      // Merge export configs
      tracesConfig.exportConfig = Object.assign(
        {},
        globalConfig.exportConfig,
        tracesConfig.exportConfig,
      );
      // Set the path if endpoint comes from general config
      if (isGenericEndpoint) {
        endpointUrl.pathname = '/v1/traces';
        tracesConfig.exportConfig.url = endpointUrl.href;
      }
      tracesConfig.resource ??= globalConfig.resource;
      sdks.push(factories.traces(tracesConfig));
    }

    return {
      shutdown() {
        return Promise.allSettled(sdks.map((s) => s.shutdown())).then(
          () => undefined,
        );
      },
    };
  };
}

/**
 * Combination of all singal SDKs into one. A shorthand for users to
 * start with all signals allowing them to pass some global configuration
 * options.
 */
export const startBrowserSdk = combineSdks({
  logs: startLogsSdk,
  traces: startTracesSdk,
});

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { setSdkLogger } from './diag.ts';
import { startLogsSdk } from './logs.ts';
import { startTracesSdk } from './traces.ts';
import type {
  CommonConfig,
  LogsConfig,
  RootConfig,
  TracesConfig,
  WebSdk,
  WebSdkFactory,
} from './types.ts';

interface SdkFactories {
  logs?: WebSdkFactory<LogsConfig>;
  traces?: WebSdkFactory<TracesConfig>;
}

/**
 * Utility funcitons to extract the configurations from the factory
 * functions and remove the common properties (which will be already
 * available at the config root)
 */
type RemoveCommonProps<T> = Omit<T, keyof CommonConfig>;
type ExtractConfigs<T> = Partial<{
  [K in keyof T]: T[K] extends WebSdkFactory<infer C>
    ? RemoveCommonProps<C>
    : never;
}>;

const DEFAULT_OTLP_ENDOINT = 'http://localhost:4318';
const DEFAULT_CONFIG: RootConfig = {
  disabled: false,
  logLevel: 'INFO',
};

/**
 * Combines different SDK factory functions into a single one
 * which accepts a global configuration along
 */
function combineSdks<T extends SdkFactories>(
  factories: T,
): WebSdkFactory<RootConfig & ExtractConfigs<T>> {
  // The returned function will transform some of the global
  // configuration options to signal specific ones if the SDK is available
  return function startSdk(config?: RootConfig & ExtractConfigs<T>) {
    // Check the global config and set defaults
    const rootConfig = Object.assign({}, DEFAULT_CONFIG, config) as RootConfig;

    // Set the logger
    setSdkLogger(config?.logLevel || 'INFO');

    // Export
    rootConfig.exportConfig = Object.assign(
      { endpoint: DEFAULT_OTLP_ENDOINT },
      rootConfig.exportConfig,
    );

    // TODO: questions (for the SIG?)
    // - accept resource detectors?
    // - how to avoid creating different resources (here and in signals)
    //   - in the config? may be misleading for users seeing
    //   - maybe using an internal module with set/get like diag
    rootConfig.resourceAttributes ??= {};
    if (rootConfig.serviceName) {
      rootConfig.resourceAttributes['service.name'] = rootConfig.serviceName;
    }
    if (rootConfig.serviceVersion) {
      rootConfig.resourceAttributes['service.name'] = rootConfig.serviceVersion;
    }

    const sdks: WebSdk[] = [];
    const endpointUrl = new URL(rootConfig.exportConfig!.url!);

    // Start logs
    if (factories.logs) {
      const logsConfig = (config?.logs || {}) as LogsConfig;
      const isGenericEndpoint = !logsConfig.exportConfig?.url;

      // Merge export configs
      logsConfig.exportConfig = Object.assign(
        {},
        rootConfig.exportConfig,
        logsConfig.exportConfig,
      );
      // Set the path if endpoint comes from general config
      if (isGenericEndpoint) {
        endpointUrl.pathname = '/v1/logs';
        logsConfig.exportConfig.url = endpointUrl.href;
      }
      logsConfig.resourceAttributes = rootConfig.resourceAttributes;
      sdks.push(factories.logs(logsConfig));
    }

    // Start traces
    if (factories.traces) {
      const tracesConfig = (config?.traces || {}) as TracesConfig;
      const isGenericEndpoint = !tracesConfig.exportConfig?.url;

      // Merge export configs
      tracesConfig.exportConfig = Object.assign(
        {},
        rootConfig.exportConfig,
        tracesConfig.exportConfig,
      );
      // Set the path if endpoint comes from general config
      if (isGenericEndpoint) {
        endpointUrl.pathname = '/v1/traces';
        tracesConfig.exportConfig.url = endpointUrl.href;
      }
      tracesConfig.resourceAttributes = rootConfig.resourceAttributes;
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

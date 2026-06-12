/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { setSdkLogger } from './diag.ts';
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
 * Utility functions to extract the configurations from the factory
 * functions and remove the common properties (which will be already
 * available at the config root)
 */
type RemoveCommonProps<T> = Omit<T, keyof CommonConfig>;
type ExtractConfigs<T> = Partial<{
  [K in keyof T]: T[K] extends WebSdkFactory<infer C>
    ? RemoveCommonProps<C>
    : never;
}>;

const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';
const DEFAULT_CONFIG: RootConfig = {
  disabled: false,
  logLevel: 'INFO',
};

/**
 * Combines different SDK factory functions into a single one
 * which accepts a global configuration along
 */
export function combineSdks<T extends SdkFactories>(
  factories: T,
): WebSdkFactory<RootConfig & ExtractConfigs<T>> {
  // The returned function will transform some of the global
  // configuration options to signal specific ones if the SDK is available
  return function startSdk(config?: RootConfig & ExtractConfigs<T>) {
    // Check the global config and set defaults
    const rootConfig = Object.assign({}, DEFAULT_CONFIG, config) as RootConfig;

    // Set the logger
    setSdkLogger(rootConfig?.logLevel);

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
      rootConfig.resourceAttributes['service.version'] =
        rootConfig.serviceVersion;
    }

    // Export
    rootConfig.exportConfig = {
      url: DEFAULT_OTLP_ENDPOINT,
      ...rootConfig.exportConfig,
    };

    const sdks: WebSdk[] = [];
    const endpointUrl = URL.parse(
      rootConfig.exportConfig?.url || DEFAULT_OTLP_ENDPOINT,
    );

    if (!endpointUrl) {
      diag.error(
        `Invalid export URL "${rootConfig.exportConfig.url}". Browser SDK won't start.`,
      );
      // TODO: need to discuss with the SIG if it's better to return `undefined`
      return {
        shutdown: () => Promise.resolve(),
      };
    }

    // Start logs
    if (factories.logs) {
      const logsConfig = (config?.logs || {}) as LogsConfig;
      const isGenericEndpoint = !logsConfig.exportConfig?.url;

      // Check for root configs if processor or exporter are not defined
      if (!logsConfig.batchProcessorConfig) {
        logsConfig.batchProcessorConfig = rootConfig.batchProcessorConfig || {};
      }
      if (!logsConfig.exportConfig) {
        logsConfig.exportConfig = rootConfig.exportConfig || {};
      }

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

      // Check for root configs if processor or exporter are not defined
      if (!tracesConfig.batchProcessorConfig) {
        tracesConfig.batchProcessorConfig =
          rootConfig.batchProcessorConfig || {};
      }
      if (!tracesConfig.exportConfig) {
        tracesConfig.exportConfig = rootConfig.exportConfig || {};
      }

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
          (results) => {
            const errors = [];
            for (const res of results) {
              if (res.status === 'rejected') {
                errors.push(res.reason);
              }
            }
            if (errors.length > 0) {
              throw new Error(
                `Shutdown process failed. Reason: ${errors.join(', ')}`,
              );
            }
          },
        );
      },
    };
  };
}

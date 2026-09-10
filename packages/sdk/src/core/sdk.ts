/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { setSdkLogger } from './diag.ts';
import type {
  CommonConfig,
  LogsConfig,
  RootConfig,
  TracesConfig,
  WebSdk,
} from './types.ts';

type WebSdkFactory<T> = (config?: T) => WebSdk;

interface SdkFactories {
  logs?: WebSdkFactory<LogsConfig>;
  traces?: WebSdkFactory<TracesConfig>;
}

/**
 * Utility types to extract the configurations from the factory
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
const NOOP_SDK = { shutdown: () => Promise.resolve() };

/**
 * Propagates the root config into a signal config and sets the signal path on
 * the export URL. A signal that opts out of an export URL the user set is
 * reported through `diag`, so a dropped OTLP export is not silent.
 */
function propagateRootConfig(
  signalConfig: LogsConfig | TracesConfig,
  rootConfig: RootConfig,
  rootEndpoint: URL,
  signal: 'logs' | 'traces',
  rootUrlIsFromUser: boolean,
) {
  const signalPath = `/v1/${signal}`;
  const isGenericEndpoint = !signalConfig.exportConfig?.url;

  // A batch processor is created when the signal has no `processors` of its own
  // and also when it sets `exportConfig`, so its config must follow in both cases
  if (
    !signalConfig.batchProcessorConfig &&
    (!signalConfig.processors || signalConfig.exportConfig)
  ) {
    signalConfig.batchProcessorConfig = rootConfig.batchProcessorConfig || {};
  }
  if (!signalConfig.processors && !signalConfig.exportConfig) {
    // Copy: the signal path below is written to this object, so sharing it
    // would leak one signal's URL into the other
    signalConfig.exportConfig = { ...rootConfig.exportConfig };
  }

  if (signalConfig.processors && !signalConfig.exportConfig) {
    if (rootUrlIsFromUser) {
      diag.warn(
        `The "${signal}" config sets \`processors\`, so the root \`exportConfig\` is not propagated and the SDK exports nothing over OTLP. Set \`${signal}.exportConfig\` to keep the OTLP export next to your processors.`,
      );
    }
    return;
  }

  if (isGenericEndpoint && signalConfig.exportConfig) {
    // Copy: writing the signal path into the shared root URL would leak it
    // into the next signal
    const endpointUrl = new URL(rootEndpoint.href);

    if (endpointUrl.pathname !== '/') {
      diag.warn(
        `The export URL path "${endpointUrl.pathname}" is replaced by "${signalPath}". Set \`${signal}.exportConfig.url\` with the full path to keep it.`,
      );
    }
    endpointUrl.pathname = signalPath;
    signalConfig.exportConfig.url = endpointUrl.href;
  }
}

/**
 * Combines different SDK factory functions into a single one which accepts a
 * root configuration shared by every signal
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

    if (config?.disabled) {
      diag.debug('Browser SDK disabled by configuration.');
      // TODO: need to discuss with the SIG if it's better to return `undefined`
      return NOOP_SDK;
    }

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

    // Export. Record whether the URL came from the user before the default
    // hides it: only then is a dropped export worth warning about
    const rootUrlIsFromUser = !!config?.exportConfig?.url;
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
      return NOOP_SDK;
    }

    // Start logs
    if (factories.logs) {
      const logsConfig = (config?.logs || {}) as LogsConfig;

      propagateRootConfig(
        logsConfig,
        rootConfig,
        endpointUrl,
        'logs',
        rootUrlIsFromUser,
      );
      logsConfig.resourceAttributes = rootConfig.resourceAttributes;
      sdks.push(factories.logs(logsConfig));
    }

    // Start traces
    if (factories.traces) {
      const tracesConfig = (config?.traces || {}) as TracesConfig;

      propagateRootConfig(
        tracesConfig,
        rootConfig,
        endpointUrl,
        'traces',
        rootUrlIsFromUser,
      );
      tracesConfig.resourceAttributes = rootConfig.resourceAttributes;
      sdks.push(factories.traces(tracesConfig));
    }

    // Register instrumentations
    let deregisterInstrumentations: (() => void) | undefined;
    if (rootConfig.instrumentations?.length) {
      deregisterInstrumentations = registerInstrumentations({
        instrumentations: rootConfig.instrumentations,
      });
    }

    return {
      shutdown() {
        deregisterInstrumentations?.();
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

/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { INVALID_CONFIG_SDK, NOOP_SDK } from './core/constants.ts';
import { setSdkLogger } from './core/diag.ts';
import { parseExportUrl } from './core/exportUrl.ts';
import type {
  CommonConfig,
  LogsConfig,
  RemoveCommonProps,
  RootConfig,
  TracesConfig,
  WebSdk,
} from './core/types.ts';
import { startLogsSdk } from './logs/startLogsSdk.ts';
import { startTracesSdk } from './traces/startTracesSdk.ts';

/**
 * Concrete view of the config used inside `startSdk`. It is structurally a
 * superset of `RootConfig & ExtractConfigs<T>` for any `T`, so the returned
 * function stays assignable to the precise, factory-derived public type while
 * the body can read each signal's config without casting.
 */
type CombinedConfig = RootConfig & {
  logs?: RemoveCommonProps<LogsConfig>;
  traces?: RemoveCommonProps<TracesConfig>;
};

const DEFAULT_CONFIG: RootConfig = {
  disabled: false,
  logLevel: 'INFO',
};

/**
 * Combination of all singal SDKs into one. A shorthand for users to
 * start with all signals allowing them to pass some global configuration
 * options.
 */
export function startBrowserSdk(config: CombinedConfig): WebSdk {
  // Check the global config and set defaults
  const rootConfig = Object.assign({}, DEFAULT_CONFIG, config) as RootConfig;

  // Set the logger
  setSdkLogger(rootConfig?.logLevel);

  if (config?.disabled) {
    diag.debug('Browser SDK disabled by configuration.');
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

  const sdks: WebSdk[] = [];

  // Resolve each signal's config once so it can be validated here and reused
  // when starting the signals below.
  const logsConfig: LogsConfig = config?.logs || {};
  const tracesConfig: TracesConfig = config?.traces || {};
  // Validate every explicitly-configured signal export URL before starting
  // any signal SDK, so an invalid URL cannot leave one signal exporting
  // while the other refuses to start. Unset URLs keep the per-signal
  // defaults (http://localhost:4318/v1/logs and /v1/traces), which are
  // valid by construction. `!== undefined` and not a truthiness check: an
  // empty `url` is a mistake, usually an unset env var, so it must fail
  // loudly instead of silently falling back to the local collector.
  const signalExportUrls: [string, string | undefined][] = [
    ['Logs SDK', logsConfig.exportConfig?.url],
    ['Traces SDK', tracesConfig.exportConfig?.url],
  ];
  for (const [scope, signalUrl] of signalExportUrls) {
    if (signalUrl !== undefined && !parseExportUrl(signalUrl, scope)) {
      return INVALID_CONFIG_SDK;
    }
  }

  // Start logs if configured
  if (logsConfig) {
    // Set the logLevel
    logsConfig.logLevel = rootConfig.logLevel;

    // Propagate root configs to the signal only when it has no custom
    // processors. A signal with its own processors manages its own exporter,
    // so the root exportConfig / batchProcessorConfig are not pushed down —
    // the signal's own exportConfig, if any, is still honored downstream.
    if (!logsConfig.processors) {
      if (!logsConfig.batchProcessorConfig) {
        logsConfig.batchProcessorConfig = rootConfig.batchProcessorConfig || {};
      }
      if (!logsConfig.exportConfig) {
        logsConfig.exportConfig = rootConfig.exportConfig || {};
      }
    }

    logsConfig.resourceAttributes = rootConfig.resourceAttributes;
    sdks.push(startLogsSdk(logsConfig));
  }

  // Start traces if configured
  if (tracesConfig) {
    // Set the logLevel
    tracesConfig.logLevel = rootConfig.logLevel;

    // Propagate root configs to the signal only when it has no custom
    // processors. A signal with its own processors manages its own exporter,
    // so the root exportConfig / batchProcessorConfig are not pushed down —
    // the signal's own exportConfig, if any, is still honored downstream.
    if (!tracesConfig.processors) {
      if (!tracesConfig.batchProcessorConfig) {
        tracesConfig.batchProcessorConfig =
          rootConfig.batchProcessorConfig || {};
      }
      if (!tracesConfig.exportConfig) {
        tracesConfig.exportConfig = rootConfig.exportConfig || {};
      }
    }

    tracesConfig.resourceAttributes = rootConfig.resourceAttributes;
    sdks.push(startTracesSdk(tracesConfig));
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
}

export type QuickStartConfig = Pick<
  CommonConfig,
  | 'disabled'
  | 'logLevel'
  | 'serviceName'
  | 'serviceVersion'
  | 'instrumentations'
> & {
  /**
   * Target URL for the SDK to send log records, used exactly as configured.
   * Default value is 'http://localhost:4318/v1/logs'
   */
  logsExportUrl?: string;
  /**
   * Target URL for the SDK to send spans, used exactly as configured.
   * Default value is 'http://localhost:4318/v1/traces'
   */
  tracesExportUrl?: string;
  /**
   * Headers to be added to each traces/logs export request.
   * This is the place to add API keys or similar.
   */
  exportHeaders?: Record<string, string>;
};

/**
 * This function does the same as `startBrowserSdk` but requiring
 * a much simpler configuration object.
 */
export function quickStartBrowserSdk(config: QuickStartConfig) {
  const sdkConfig: Parameters<typeof startBrowserSdk>[0] = {
    disabled: config.disabled,
    logLevel: config.logLevel,
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    instrumentations: config.instrumentations,
    // Explicit export configuration enables the Batch processors. Each
    // signal exports to the full URL given here; when a URL is not set,
    // the signal keeps its own default endpoint.
    logs: {
      exportConfig: {
        url: config.logsExportUrl,
        headers: config.exportHeaders,
      },
    },
    traces: {
      exportConfig: {
        url: config.tracesExportUrl,
        headers: config.exportHeaders,
      },
    },
  };

  return startBrowserSdk(sdkConfig);
}

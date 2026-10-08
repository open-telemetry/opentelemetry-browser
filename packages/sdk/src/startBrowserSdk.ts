/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogLevel } from '@opentelemetry/api';
import { diag } from '@opentelemetry/api';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace';
import { INVALID_CONFIG_SDK, NOOP_SDK } from './core/constants.ts';
import { setSdkLogger } from './core/diag.ts';
import { parseExportUrl } from './core/exportUrl.ts';
import type {
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

const DEFAULT_OTLP_ENDPOINT = 'http://localhost:4318';
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

  // Export
  rootConfig.exportConfig = {
    url: DEFAULT_OTLP_ENDPOINT,
    ...rootConfig.exportConfig,
  };

  const sdks: WebSdk[] = [];

  // Validate every export URL before starting any signal SDK, so an invalid
  // URL cannot leave one signal exporting while the other refuses to start.
  const endpointUrl = parseExportUrl(
    rootConfig.exportConfig?.url || DEFAULT_OTLP_ENDPOINT,
  );
  if (!endpointUrl) {
    return INVALID_CONFIG_SDK;
  }
  // Resolve each signal's config once so it can be validated here and reused
  // when starting the signals below.
  const logsConfig: LogsConfig = config?.logs || {};
  const tracesConfig: TracesConfig = config?.traces || {};
  const signalExportUrls: [string, string | undefined][] = [
    ['Logs SDK', logsConfig.exportConfig?.url],
    ['Traces SDK', tracesConfig.exportConfig?.url],
  ];
  for (const [scope, signalUrl] of signalExportUrls) {
    // Only bail out when a signal explicitly sets an invalid URL. An unset
    // signal URL inherits the (already validated) root endpoint, so it must
    // not block the SDK from starting.
    if (signalUrl && !parseExportUrl(signalUrl, scope)) {
      return INVALID_CONFIG_SDK;
    }
  }

  // Start logs if configured
  if (logsConfig) {
    const isGenericEndpoint = !logsConfig.exportConfig?.url;

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

    // Set the path if endpoint comes from general config
    if (isGenericEndpoint && logsConfig.exportConfig) {
      endpointUrl.pathname = '/v1/logs';
      logsConfig.exportConfig.url = endpointUrl.href;
    }
    logsConfig.resourceAttributes = rootConfig.resourceAttributes;
    sdks.push(startLogsSdk(logsConfig));
  }

  // Start traces if configured
  if (tracesConfig) {
    const isGenericEndpoint = !tracesConfig.exportConfig?.url;

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

    // Set the path if endpoint comes from general config
    if (isGenericEndpoint && tracesConfig.exportConfig) {
      endpointUrl.pathname = '/v1/traces';
      tracesConfig.exportConfig.url = endpointUrl.href;
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

export interface QuickStartConfig {
  /**
   * Set `disabled: true` to disable the SDK
   *
   * @defaultValue undefined
   */
  disabled?: boolean;
  /**
   * Log level for SDK's internal logger
   *
   * @defaultValue DiagLogLevel.INFO
   */
  logLevel?: keyof typeof DiagLogLevel;
  /**
   * Sets the value of the `service.name` resource attribute
   */
  serviceName?: string;
  /**
   * Sets the value of the `service.version` resource attribute
   *
   * @defaultValue undefined
   */
  serviceVersion?: string;
  /**
   * Target URL for the SDK to send traces and logs.
   */
  exportUrl: string;
  /**
   * Headers to be added to each traces/logs export request.
   * This is the place to add API keys or similar.
   */
  exportHeaders?: Record<string, string>;
  /**
   * List of instrumentations to be registered when the SDK starts
   */
  instrumentations?: Instrumentation[];
}

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
    // Explicit export configuration enables the Batch processors
    exportConfig: {
      url: config.exportUrl,
      headers: config.exportHeaders,
    },
  };

  // Add console processors if the user wants to debug
  if (config.logLevel === 'DEBUG') {
    sdkConfig.logs = {
      processors: [
        new SimpleLogRecordProcessor({
          exporter: new ConsoleLogRecordExporter(),
        }),
      ],
    };
    sdkConfig.traces = {
      processors: [
        new SimpleSpanProcessor({ exporter: new ConsoleSpanExporter() }),
      ],
    };
  }

  return startBrowserSdk(sdkConfig);
}

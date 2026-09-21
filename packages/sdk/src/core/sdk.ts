/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { setSdkLogger } from './diag.ts';
import { parseExportUrl } from './exportUrl.ts';
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
// Returned when the SDK is intentionally turned off via `config.disabled`.
const NOOP_SDK: WebSdk = { shutdown: () => Promise.resolve() };
// Returned when the SDK refuses to start because of an invalid configuration
// (e.g. a bad export URL). `invalidConfig` lets callers tell this apart from an
// intentional disable and surface the mistake.
const INVALID_CONFIG_SDK: WebSdk = {
  invalidConfig: true,
  shutdown: () => Promise.resolve(),
};

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
  rootExportIsFromUser: boolean,
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
  } else if (signalConfig.exportConfig) {
    // Root options the signal did not set still apply. `headers` carries the
    // collector auth, so dropping it exports to the right URL and gets a 401
    signalConfig.exportConfig = {
      ...rootConfig.exportConfig,
      ...signalConfig.exportConfig,
    };
  }

  if (signalConfig.processors && !signalConfig.exportConfig) {
    if (rootExportIsFromUser) {
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
        `The export URL path "${endpointUrl.pathname}" is replaced by "${signalPath}". To keep it, use \`startBrowserSdk\` and set \`${signal}.exportConfig.url\` with the full path.`,
      );
    }
    endpointUrl.pathname = signalPath;
    signalConfig.exportConfig.url = endpointUrl.href;
  }
}

/**
 * Combines different SDK factory functions into a single one
 * which accepts a global configuration along
 */
export function combineSdks<T extends SdkFactories>(
  factories: T,
): WebSdkFactory<RootConfig & ExtractConfigs<T>> {
  // The returned function will transform some of the global
  // configuration options to signal specific ones if the SDK is available
  return function startSdk(config?: CombinedConfig) {
    // Check the global config and set defaults
    const rootConfig = Object.assign({}, DEFAULT_CONFIG, config) as RootConfig;

    // Set the logger
    // The user's value, not `rootConfig`'s: the default would look like a level
    // they chose and warn about being ignored on a second start
    setSdkLogger(config?.logLevel);

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

    // Export. Record whether the user set any export option before the default
    // hides it: only then is a dropped export worth warning about. Headers
    // alone count, since they configure an export just as much as a URL does
    const rootExportIsFromUser = !!config?.exportConfig;
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

    // Start logs
    if (factories.logs) {
      propagateRootConfig(
        logsConfig,
        rootConfig,
        endpointUrl,
        'logs',
        rootExportIsFromUser,
      );
      logsConfig.resourceAttributes = rootConfig.resourceAttributes;
      sdks.push(factories.logs(logsConfig));
    }

    // Start traces
    if (factories.traces) {
      propagateRootConfig(
        tracesConfig,
        rootConfig,
        endpointUrl,
        'traces',
        rootExportIsFromUser,
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
      // A signal that refused to start already logged the reason, but the flag
      // is the only way a caller can detect it from the combined SDK
      invalidConfig: sdks.some((sdk) => sdk.invalidConfig) || undefined,
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

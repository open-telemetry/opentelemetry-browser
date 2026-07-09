# OpenTelemetry SDK for Browsers

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

**Note: This is an experimental package under active development. New releases may include breaking changes.**

This package provides the required components to start an OpenTelemetry SDK for Browser including
logs and traces. Metrics are out of the scope for now
<!-- TODO: add referecnce to the discussion about metrics for browser  -->

## Quick Start

**Note: This documentation assumes you have a bundler in your tool chain that can handle ESM modules.**

To get started you need to install `@opentelemetry/browser-sdk` and any appropriate instrumentation for the
events or tasks performed by your application.

### Installation

```bash
# Install the package
npm install @opentelemetry/browser-sdk

# Install the instrumentations
npm install @opentelemetry/browser-instrumentation \ # add OTEL instrumentations for browser
    @opentelemetry/instrumentation-fetch # or any other instrumentation outside this repo
```

`@opentelemetry/api` is a **peer dependency** (v1.9+). Install it in your application if you intend
to do manual instrumentation of your web application.


### Initialize the SDK

The Browser SDK should be loaded and started as soon as possible for better measurements
and to avoid any other library to patch or modify browser APIs used by the SDK and the instrumentations.
Loading the SDK after some library has pacthed Browser's API may affect the behavior of the internal
components, like exporters, and instrumentations in unexpected ways.

This example shows how to setup the SDK exporting logs and traces to a specific OTLP endpoint URL with
a couple of customized headers. 

```javascript
import { quickStartBrowserSdk } from '@opentelemetry/browser-sdk';

// Start the SDK 
const sdk = quickStartBrowserSdk({
  // Optional - you may disable the SDK in certain situations. For example if the UA is a bot.
  disabled: false,
  // Optional - possible values are: ALL, VERBOSE, DEBUG, INFO, WARN, ERROR, NONE. Default value is 'INFO'
  logLevel: 'DEBUG',
  // Optional - name of the service being instrumented. Default value is 'unknown_service'
  serviceName: 'my-service',
  // Optional - version of the service. Default value is undefined
  serviceVersion: '1.0',
  // Required - URL of the collector that will accept the export requests
  exportUrl: 'https://collector.mycompany.com',
  // Optional - Headers to be added in each export request for all signals
  exportHeaders: { foo: 'bar' },
});
```

If you need a deeper control of the configuration the `startBrowserSdk` function accepts an
extended configuration object to tune some other component and also apply specific configuration per signal.
The following example sets some extra resource attributes and the limits for spans and log records.

```javascript
import { startBrowserSdk } from '@opentelemetry/browser-sdk';

// Start the SDK 
const sdk = startBrowserSdk({
  // Optional - you may disable the SDK in certain situations. For example if the UA is a bot.
  disabled: false,
  // Optional - possible values are: ALL, VERBOSE, DEBUG, INFO, WARN, ERROR, NONE. Default value is 'INFO'
  logLevel: 'DEBUG',
  // Optional - name of the service being instrumented. Default value is 'unknown_service'
  serviceName: 'my-service',
  // Optional - version of the service. Default value is undefined
  serviceVersion: '1.0',
  // Optional - attributes to append to the resource. Default value is undefined
  resourceAttributes: {
    'browser.has_speech_recognition': typeof SpeechRecognition === 'function'
  },
  // Optional - configuration for HTTP exporter. Default value is { url: 'http://localhost:4318', headers: {} }
  exportConfig: {
    url: 'https://collector.mycompany.com',
    headers: { foo: 'bar' }
  },
  // Optional - logs signal configuration. Default empty empty. See below for more options
  logs: {
    logRecordLimits: { attributeCountLimit: 128 },
  },
  // Optional - traces signal configuration. Default empty empty. See below for more options
  traces: {
    spanLimits: { attributeCountLimit: 128 },
  },
});

// You can also use the `shutdown` method to gracefuly shut down the SDK and stop collection and
// data export.
sdk.shutdown().then(
  () => console.log("SDK shut down successfully"),
  (err) => console.log("Error shutting down SDK", err)
);
```

You can include the code in a separate file or in the main entry point of your application. Your bundler
should pull the dependencies and set the final code in the build/dist folder. The first option is recomended
because you can ensure the SDK is loaded first in you HTML before any lib or framework touches the `Window`
object.

### Initialize the SDK for a specific Signal

The previous example configures logs and traces signals. Although this is conveinent there might be scenarios
when you don't need a specific signal and don't want to pay the toll of sending unused code to your clients. As
an example if none of the selected instrumentations send traces there is no need to setup the traces SDK.

For that purpose `@opentelemetry/browser-sdk` provides functions to start signal specific SDKs (logs, traces)
independently. Each signal SDK function has its own subpath point so bundlers can easily tree shake the
code related to other signals.

| Subpath                         | Purpose                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `@opentelemetry/browser-sdk/logs`   | `startLogsSdk` — setup logs and registers a LoggerProvider     |
| `@opentelemetry/browser-sdk/traces` | `startTracesSdk` — setup traces and registers a TracerProvider |


#### Initialize logs SDK

This example shows how to setup the logs SDK exporting to a specific OTLP endpoint URL with
a couple of customized headers.

```javascript
import { startLogsSdk } from '@opentelemetry/browser-sdk/logs';

// Start the SDK 
const logsSdk = startLogsSdk({
  // Optional - you may disable the SDK in certain situations. For example if the UA is a bot.
  disabled: false,
  // Optional - possible values are: ALL, VERBOSE, DEBUG, INFO, WARN, ERROR, NONE. Default value is 'INFO'
  logLevel: 'DEBUG',
  // Optional - name of the service being instrumented. Default value is 'unknown_service'
  serviceName: 'my-service',
  // Optional - version of the service. Default value is undefined
  serviceVersion: '1.0',
  // Optional - attributes to append to the resource. Default value is undefined
  resourceAttributes: {
    'browser.has_speech_recognition': typeof SpeechRecognition === 'function'
  },
  // Optional - configuration for HTTP exporter. Default value is { url: 'http://localhost:4318/v1/logs', headers: {} }
  // Note: this config expects the full URL. Signal path is not added.
  exportConfig: {
    url: 'https://collector.mycompany.com/v1/logs',
    headers: { foo: 'bar' }
  },
  // Optional - record limits. Default is undefined.
  logRecordLimits: { attributeCountLimit: 128 },
  // See the configuration section below for additional configuration options
});

// You can also use the `shutdown` method to gracefuly shut down the logs SDK and stop collection and
// data export.
logsSdk.shutdown().then(
  () => console.log("SDK shut down successfully"),
  (err) => console.log("Error shutting down SDK", err)
);
```


#### Initialize traces SDK

This example shows how to setup the traces SDK exporting to a specific OTLP endpoint URL with
a couple of customized headers.

```javascript
import { startTracesSdk } from '@opentelemetry/browser-sdk/traces';

// Start the SDK 
const tracesSdk = startTracesSdk({
  // Optional - you may disable the SDK in certain situations. For example if the UA is a bot.
  disabled: false,
  // Optional - possible values are: ALL, VERBOSE, DEBUG, INFO, WARN, ERROR, NONE. Default value is 'INFO'
  logLevel: 'DEBUG',
  // Optional - name of the service being instrumented. Default value is 'unknown_service'
  serviceName: 'my-service',
  // Optional - version of the service. Default value is undefined
  serviceVersion: '1.0',
  // Optional - attributes to append to the resource. Default value is undefined
  resourceAttributes: {
    'browser.has_speech_recognition': typeof SpeechRecognition === 'function'
  },
  // Optional - configuration for HTTP exporter. Default value is { url: 'http://localhost:4318/v1/traces', headers: {} }
  // Note: this config expects the full URL. Signal path is not added.
  exportConfig: {
    url: 'https://collector.mycompany.com/v1/traces',
    headers: { foo: 'bar' }
  },
  // Optional - span limits. Default is undefined.
  spanLimits: { attributeCountLimit: 128 },
  // See the configuration section below for additional configuration options
});

// You can also use the `shutdown` method to gracefuly shut down the traces SDK and stop collection and
// data export.
tracesSdk.shutdown().then(
  () => console.log("SDK shut down successfully"),
  (err) => console.log("Error shutting down SDK", err)
);
```

## Configuration

### Common configuration

The following configuration options are common to each independent SDK. When using `startBrowserSdk` which
combines all signals these options are accepted and the top level of the configuration and they don't need to
be in signal specific configuration. See the example below.

```javascript
// Signal SDK accepts some configs
startLogsSdk({ serviceName: 'my-serivce' });

// When starting all at once...
startBrowserSdk({
  // this option goes on top (so it's aplied for all signals)
  serviceName: 'my-serivce',
  logs: {
    // there is no need to specify `serviceName` here
  },
})
```

#### disabled

Set `disabled: true` to disable the SDK.

#### logLevel

Log level for SDK's internal logger. Default value is 'INFO'.

#### serviceName

Sets the value of the [service.name](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/registry/attributes/service.md#service-name) resource attribute.

#### serviceVersion

Sets the value of the [service.version](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/registry/attributes/service.md#service-version) resource attribute.

#### resourceAttributes

Key-value pairs to be used as resource attributes.

### Logs configuration

#### processorConfig

Object containing configuration options for the batch processing of log records. These options are:

- `scheduledDelayMillis`: Delay interval (in milliseconds) between two consecutive exports.
- `exportTimeoutMillis`: Maximum allowed time (in milliseconds) to export data.
- `maxQueueSize`: Maximum queue size.
- `maxExportBatchSize`: Maximum batch size.

Note: you can pass this option to `startBrowserSdk` if you want to apply the same to all signals. If
the option is defined at the top level and within the signal configuration the later wins.

#### exportConfig

Object containing configuraiton options for the HTTP log record exporter. These options are:

- `url`: Target to which the exporter is going to send logs.
- `headers`: Key-value pairs to be used as headers associated with HTTP requests.

Note: you can pass this option to `startBrowserSdk` if you want to apply the same to all signals. If
the option is defined at the top level and within the signal configuration the later wins.

#### logRecordLimits

Object containing configuraiton options log record limits. These options are:

- `attributeValueLengthLimit`: Maximum allowed attribute value size.
- `attributeCountLimit`: Maximum allowed attribute count.

#### processors

List of LogRecordProcessor for the logger provider. Setting this will make the SDK ignore `processorConfig`
and `exportConfig` since no `BatchLogRecordProcessor` will be created.

### Traces configuration

#### processorConfig

Object containing configuraiton options for the batch processing of spans. These options are:

- `scheduledDelayMillis`: Delay interval (in milliseconds) between two consecutive exports.
- `exportTimeoutMillis`: Maximum allowed time (in milliseconds) to export data.
- `maxQueueSize`: Maximum queue size.
- `maxExportBatchSize`: Maximum batch size.

Note: you can pass this option to `startBrowserSdk` if you want to apply the same to all signals. If
the option is defined at the top level and within the `traces` signal configuration the later wins.

#### exportConfig

Object containing configuraiton options for the HTTP span exporter. These options are:

- `url`: Target to which the exporter is going to send traces.
- `headers`: Key-value pairs to be used as headers associated with HTTP requests.

Note: you can pass this option to `startBrowserSdk` if you want to apply the same to all signals. If
the option is defined at the top level and within the `traces` signal configuration the later wins.

#### spanLimits

Object containing configuraiton options span limits. These options are:

- `attributeValueLengthLimit`: Maximum allowed attribute value size.
- `attributeCountLimit`: Maximum allowed attribute count.
- `linkCountLimit`: Maximum allowed link count.
- `eventCountLimit`: Maximum allowed event count.
- `attributePerEventCountLimit`: Maximum allowed attribute count per span event.
- `attributePerLinkCountLimit`: Maximum allowed attribute count per span link.

#### processors

List of SpanProcessor for the tracer provider. Setting this will make the SDK ignore `processorConfig`
and `exportConfig` since no `BatchSpanProcessor` will be created.

#### contextManager

Manager to use to propagate context across different call stacks.

#### propagators

Propagators to use to carry information to other services (like backend services).

#### sampler

Sampler to be used by traces to resolve if the Spans should be recorded or not.

## Sessions

Sessions correlate multiple traces, events and logs that happen within a given time period. Sessions are represented as span/log attributes prefixed with the `session.` namespace. For additional information, see [documentation in semantic conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/general/session.md).

The `@opentelemetry/browser-sdk/session` subpath provides a default implementation of managing sessions that:

- abstracts persisting sessions across page loads, with a default implementation based on `LocalStorage`
- abstracts generating session IDs
- provides a mechanism for resetting the active session after a maximum defined duration
- provides a mechanism for resetting the active session after a defined inactivity duration

Example:

```javascript
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';

// session manager
const sessionManager = createSessionManager({
  sessionIdGenerator: createDefaultSessionIdGenerator(),
  sessionStore: createLocalStorageSessionStore(),
  maxDuration: 4 * 60 * 60, // 4 hours
  inactivityTimeout: 30 * 60, // 30 minutes
});

// restore or start the session
await sessionManager.start();

startBrowserSdk({
  serviceName: 'my-service',
  traces: {
    processors: [createSessionSpanProcessor(sessionManager)],
  },
  logs: {
    processors: [createSessionLogRecordProcessor(sessionManager)],
  },
});
```

The session processors must be registered **before** the export processors so the `session.id` attribute is set on each span / log record before it is exported.

For session lifecycle details, configuration reference, observing sessions, custom `SessionStore`/`SessionIdGenerator` implementations, and known limitations, see [Session Management](../../docs/session-management.md).

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>
- For more about OpenTelemetry for Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 — see [LICENSE][license-url].

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/browser
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fbrowser.svg

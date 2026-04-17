# @opentelemetry/browser

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

Browser-oriented helpers to start OpenTelemetry **logs** and **traces** with OTLP HTTP export. Configuration is split by signal so you import only what you use, which helps bundlers tree-shake unused code. A small **`combineSdks`** helper merges multiple signal starters into one `start`/`shutdown` object with shared global options (endpoint, headers, resource).

## Installation

```bash
npm install @opentelemetry/browser @opentelemetry/api
```

`@opentelemetry/api` is a **peer dependency** (v1.9+). Install it alongside this package.

## Package layout (subpath exports)

The package does not rely on a single heavy entry point. Use explicit subpaths:

| Subpath                         | Purpose                                      |
| ------------------------------- | -------------------------------------------- |
| `@opentelemetry/browser/logs`   | `startLogsSdk` — logs pipeline + OTLP export |
| `@opentelemetry/browser/traces` | `startTracesSdk` — traces + OTLP export      |
| `@opentelemetry/browser/sdk`    | `combineSdks` — compose multiple starters    |

## Core types

- **`WebSdk`** — `{ shutdown(): Promise<void> }` — returned by every starter; call `shutdown()` when the app unloads or telemetry should stop.
- **`WebSdkFactory<T>`** — `(config?: T) => WebSdk` — type of functions like `startLogsSdk` / `startTracesSdk` when passed into `combineSdks`.

Configuration interfaces are defined in the implementation (`GlobalConfig`, `LogsConfig`, `TracesConfig`). Highlights:

- **`GlobalConfig`** (for `combineSdks` only): shared OTLP base URL (`otlpEndpoint`, default `http://localhost:4318`), `otlpHeaders`, optional `resource`, plus fields reserved for future use (e.g. diagnostics, limits).
- **`LogsConfig`**: `resource`, OTLP URL `otlpLogsEndpoint` (default `http://localhost:4318/v1/logs`), `otlpLogsHeaders`, batch processor tuning (`blrpScheduleDelay`, `blrpExportTimeout`, `blrpMaxQueueSize`, `blrpMaxExportBatchSize`), `logRecordLimits`.
- **`TracesConfig`**: optional `contextManager` and `textMapPropagator` (see `@opentelemetry/api`), `resource`, `sampler`, `spanLimits`, OTLP URL `otlpTracesEndpoint` (default `http://localhost:4318/v1/traces`), `otlpTracesHeaders`, batch span processor tuning (`bspScheduleDelay`, `bspExportTimeout`, `bspMaxQueueSize`, `bspMaxExportBatchSize`).

## Usage

### Logs only

```ts
import { startLogsSdk } from '@opentelemetry/browser/logs';

const logsSdk = startLogsSdk({
  // e.g. otlpLogsEndpoint, otlpLogsHeaders, resource, logRecordLimits, …
});

// when tearing down (e.g. page unload)
await logsSdk.shutdown();
```

`startLogsSdk` registers a global logger provider (`@opentelemetry/api-logs`) with a batch processor and OTLP HTTP exporter.

### Traces only

```ts
import { startTracesSdk } from '@opentelemetry/browser/traces';

const tracesSdk = startTracesSdk({
  // e.g. otlpTracesEndpoint, sampler, contextManager, textMapPropagator, …
});

await tracesSdk.shutdown();
```

`startTracesSdk` registers a global tracer provider and optional context manager / propagator when provided.

### Multiple signals with shared settings

Use **`combineSdks`** from `@opentelemetry/browser/sdk` to pass one merged config (global options plus nested `logs` / `traces` sections) and get a single `shutdown`:

```ts
import { combineSdks } from '@opentelemetry/browser/sdk';
import { startLogsSdk } from '@opentelemetry/browser/logs';
import { startTracesSdk } from '@opentelemetry/browser/traces';

const startMySdk = combineSdks({
  logs: startLogsSdk,
  traces: startTracesSdk,
});

const mySdk = startMySdk({
  otlpEndpoint: 'https://otel.example.com:4318',
  otlpHeaders: { Authorization: 'Bearer …' },
  logs: {
    otlpLogsHeaders: { 'x-logs': 'foo' },
  },
  traces: {
    otlpTracesHeaders: { 'x-traces': 'bar' },
  },
});

await mySdk.shutdown();
```

Behavior notes:

- If you omit signal-specific OTLP URLs, **`otlpEndpoint`** is used as a base and paths `/v1/logs` and `/v1/traces` are applied automatically.
- **`otlpHeaders`** at the global level is applied to each signal unless overridden by `otlpLogsHeaders` / `otlpTracesHeaders`.
- A default **`resource`** is applied when using `combineSdks` if you do not set `resource` globally or per signal.

## After startup

Use the standard OpenTelemetry APIs for your signals, for example `@opentelemetry/api` for traces and `@opentelemetry/api-logs` for logs, now that global providers are registered.

## License

Apache 2.0 — see [LICENSE][license-url].

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/browser
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fbrowser.svg

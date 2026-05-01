# @opentelemetry/browser-instrumentation

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

OpenTelemetry browser instrumentations, available as subpath exports under `./experimental/*`.

## Installation

```bash
npm install @opentelemetry/browser-instrumentation
```

## Instrumentations

- [Navigation](#navigation) — automatic instrumentation for browser navigations (initial load and SPA route changes)
- [Navigation Timing](#navigation-timing) — automatic instrumentation for navigation timing
- [Resource Timing](#resource-timing) — automatic instrumentation for resource timing
- [User Action](#user-action) — automatic instrumentation for user actions (clicks)
- [Web Vitals](#web-vitals) — automatic instrumentation for Core Web Vitals
- [Console](#console) — automatic instrumentation for console API calls (log, warn, error, info, debug)

## Usage

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new NavigationInstrumentation(),
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation(),
  ],
});
```

---

### Navigation

```typescript
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
```

Emits a `browser.navigation` event for the initial page load (hard navigation) and for subsequent in-page navigations (soft navigations), including `history.pushState`, `history.replaceState`, `popstate`, and hash changes. When enabled via config, the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) is used in preference to patching `history`.

#### Configuration

```typescript
import {
  NavigationInstrumentation,
  defaultSanitizeUrl,
} from '@opentelemetry/browser-instrumentation/experimental/navigation';

new NavigationInstrumentation({
  // Use window.navigation (Navigation API) when available instead of
  // patching history.pushState / history.replaceState. Default: false.
  useNavigationApiIfAvailable: true,

  // Rewrite the captured URL before it is emitted. Useful for stripping
  // path segments, query parameters, or tokens that should not be exported.
  sanitizeUrl: (url) => defaultSanitizeUrl(url),

  // Mutate the log record before it is emitted (e.g. attach custom attributes).
  applyCustomLogRecordData: (logRecord) => {
    logRecord.attributes = {
      ...logRecord.attributes,
      'app.route.id': '...',
    };
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useNavigationApiIfAvailable` | `boolean` | `false` | When `true`, subscribes to the Navigation API (`currententrychange`) instead of patching `history.pushState` / `history.replaceState`. Falls back to history patching when the Navigation API is unavailable. |
| `sanitizeUrl` | `(url: string) => string` | — | Called before the URL is written to `url.full`. |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | — | Hook to modify log records before they are emitted. Errors thrown from this hook are caught and logged via the instrumentation diag logger. |

`defaultSanitizeUrl` is exported for composition — it redacts `user:password@` credentials and a set of common sensitive query parameters (`api_key`, `token`, `password`, etc.).

#### Captured Attributes

Each `browser.navigation` event includes:

| Attribute | Description |
|-----------|-------------|
| `url.full` | The destination URL (after `sanitizeUrl` if configured). |
| `browser.navigation.same_document` | `true` for SPA route changes; `false` for full-page loads. |
| `browser.navigation.hash_change` | `true` when the navigation only adds or changes the URL fragment. |
| `browser.navigation.type` | One of `push`, `replace`, `reload`, `traverse` (omitted for the initial hard navigation). |

---

### Navigation Timing

```typescript
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
```

Provides automatic instrumentation for [Navigation Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming) in web applications.

---

### Resource Timing

```typescript
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
```

Provides automatic instrumentation for [Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming) in web applications, capturing performance metrics for all resources loaded by the browser (scripts, stylesheets, images, fonts, XHR/fetch requests, etc.).

- Uses `requestIdleCallback` to avoid blocking the main thread (with automatic `setTimeout` fallback for Safari)
- Processes resources in configurable batches
- Captures historical resources loaded before instrumentation was enabled via buffered mode
- Flushes pending entries on visibility change to prevent data loss

#### Configuration

```typescript
new ResourceTimingInstrumentation({
  // Process 100 resources per batch (default: 50)
  batchSize: 100,

  // Wait max 2 seconds for idle time before forcing processing (default: 1000)
  forceProcessingAfter: 2000,

  // Spend max 100ms processing per idle callback (default: 50)
  maxProcessingTime: 100,

  // Maximum queue size before forcing immediate flush (default: 1000)
  maxQueueSize: 2000,
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | `number` | `50` | Number of resources to process per batch. |
| `forceProcessingAfter` | `number` | `1000` | Maximum time (ms) to wait for an idle callback before forcing processing. |
| `maxProcessingTime` | `number` | `50` | Maximum time (ms) to spend processing resources per idle callback. |
| `maxQueueSize` | `number` | `1000` | Maximum number of resources to queue before forcing immediate flush. |

#### Captured Data

Each resource timing event includes:

- **URL** and **Initiator Type** (script, css, img, xmlhttprequest, fetch, etc.)
- **Duration** — total resource load time
- **Timing Phases** — DNS lookup, TCP connection, TLS handshake, request, response
- **Size Metrics** — transfer size, encoded size, decoded size
- **Protocol** — HTTP version (h1, h2, h3)
- **Redirect Info** — redirect timing if applicable
- **Service Worker** — worker start time if intercepted
- **Render Blocking** — whether the resource blocked rendering (Chromium only)

---

### User Action

```typescript
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
```

Provides automatic instrumentation for user actions in web applications.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

#### Configuration

By default the instrumentation captures `click` events. You can configure which events to capture by passing an options object:

```typescript
new UserActionInstrumentation({
  autoCapturedActions: [], // default is ['click']
});
```

#### Additional Attributes

Data attributes with the prefix `data-otel-` on the target element will be added as additional attributes to the generated log record. For example:

```html
<button id="btn1" data-otel-user-id="12345" data-otel-feature="signup">
  Sign Up
</button>
```

---

### Web Vitals

```typescript
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
```

Provides automatic instrumentation for [Core Web Vitals](https://web.dev/vitals/) using the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) library.

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeRawAttribution` | `boolean` | `false` | When true, sets the log record body to the JSON-stringified `web-vitals` attribution object. |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | — | Hook to modify log records before they are emitted. |

### Console

```typescript
import { ConsoleInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/console';
```

Provides automatic instrumentation for browser console API calls. By default captures `log`, `warn`, `error`, `info`, and `debug` methods.

#### Configuration

```typescript
new ConsoleInstrumentation({
  // Specify which console methods to capture (default: all five)
  logMethods: ['error', 'warn'],
});
```

#### Captured Attributes

Each console event includes the original arguments passed to the console method and the method name (`log`, `warn`, `error`, `info`, or `debug`).

---

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/browser-instrumentation
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fbrowser-instrumentation.svg

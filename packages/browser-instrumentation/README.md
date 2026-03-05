# @opentelemetry/browser-instrumentation

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

OpenTelemetry browser instrumentations, available as subpath exports under `./experimental/*`.

## Installation

```bash
npm install @opentelemetry/browser-instrumentation
```

## Instrumentations

- [Navigation Timing](#navigation-timing) — automatic instrumentation for navigation timing
- [User Action](#user-action) — automatic instrumentation for user actions (clicks)
- [Web Vitals](#web-vitals) — automatic instrumentation for Core Web Vitals

## Usage

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
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
    new NavigationTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation(),
  ],
});
```

---

### Navigation Timing

```typescript
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
```

Provides automatic instrumentation for [Navigation Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming) in web applications.

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

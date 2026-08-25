# <img src="https://opentelemetry.io/img/logos/opentelemetry-logo-nav.png" alt="OpenTelemetry Icon" width="45" height=""> OpenTelemetry Browser

## About

This repository is the home of OpenTelemetry Browser instrumentations and the future home of the OpenTelemetry Browser SDK.

This repo provides **event-based instrumentations** that emit events (structured log records) for browser performance and user interactions. It also provides **span-based instrumentations** for `fetch` and `XMLHttpRequest`. Use the instrumentations from this repository. Do not mix them with the classic instrumentations from [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) or [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib) for the same API, because both would record every call.

The classic browser instrumentations in other OpenTelemetry JS repositories will be deprecated soon. See [Migrate from classic browser instrumentations](#migrate-from-classic-browser-instrumentations) to move to this repository.

See the [Browser Packages](#browser-packages) section below for a full list of browser-related packages across all repositories.

## Quick Start

### Installation

```bash
npm install @opentelemetry/browser-instrumentation \
  @opentelemetry/api \
  @opentelemetry/api-logs \
  @opentelemetry/sdk-logs \
  @opentelemetry/instrumentation
```

### Basic example

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { ConsoleInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/console';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation(),
    new ConsoleInstrumentation(),
  ],
});
```

For detailed configuration options, see the [instrumentation package README](./packages/instrumentation/README.md).

### More examples

For a more complete setup that combines the event-based and span-based instrumentations from this repository, see the [examples](./examples/) directory.

### Sandbox

Interactive playground for testing OpenTelemetry browser instrumentations. Configure the SDK, trigger actions (fetch, XHR, errors, navigation…), and inspect exported spans and logs in real time.

#### Run locally

```bash
npm install
npm run dev
```

This starts the sandbox with hot-reload via Vite at `http://localhost:5173`.

#### GitHub Pages

The sandbox is automatically deployed to GitHub Pages on every push to `main` via the `deploy-sandbox.yml` workflow. The live site is available at [open-telemetry.github.io/opentelemetry-browser](https://open-telemetry.github.io/opentelemetry-browser/).

## Documentation

- [Session Management](./docs/session-management.md) — configuring and using the SDK's built-in session support.
- [Browser Events](./docs/browser-observability-model.md) — catalog of browser telemetry events.
- [Navigation event](./docs/navigation-event.md) — deep dive on the `browser.navigation` event.

## Browser Packages

The following tables list browser-related packages across all OpenTelemetry JS repositories.

### Packages in this repository

| Package | Description | Status |
| --- | --- | --- |
| [@opentelemetry/browser-instrumentation](./packages/instrumentation) | Browser instrumentations: event-based (console, errors, navigation, navigation timing, resource timing, user actions, web vitals) and span-based (fetch, XHR). | experimental |

### Migrate from classic browser instrumentations

The browser instrumentations in [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) and [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib) will be deprecated soon. Move to the instrumentations in this repository as soon as possible. The tables below show the replacement for each classic package.

When you migrate:

- Remove the classic instrumentation when you add its replacement. A classic instrumentation cannot detect our patches, so if you use both for the same API, every call is recorded twice.
- Some replacements emit events (log records), not spans. For example, `instrumentation-document-load` and `instrumentation-user-interaction` create spans, but their replacements create events. Set up a `LoggerProvider` for them.
- The instrumentations in this repository are enabled when you register them, not when you create them. With `enabled: false`, registration runs init but does not emit until you call `enable()`. See [Differences from classic instrumentations](./packages/instrumentation/README.md#differences-from-classic-instrumentations).
- `auto-instrumentations-web` turns on the classic instrumentations. Replace it with the instrumentations from this repository, registered with `registerInstrumentations()` or the [Browser SDK](./packages/sdk).

#### Event-based instrumentations (other repositories)

| Package | Location | Description | Status | Replacement in this repository |
| --- | --- | --- | --- | --- |
| instrumentation-browser-navigation | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-browser-navigation) | Capture browser navigation events (SPA route changes). | experimental | [Navigation](./packages/instrumentation/README.md#navigation) |
| instrumentation-web-exception | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-web-exception) | Capture unhandled exceptions and promise rejections. | experimental | [Errors](./packages/instrumentation/README.md#errors) |

#### Span-based instrumentations (other repositories)

| Package | Location | Description | Status | Replacement in this repository |
| --- | --- | --- | --- | --- |
| opentelemetry-instrumentation-fetch | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-fetch) | Instrumentation for the Fetch API. | experimental | [Fetch](./packages/instrumentation/README.md#fetch) |
| opentelemetry-instrumentation-xml-http-request | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-xml-http-request) | Instrumentation for XMLHttpRequest. | experimental | [XHR](./packages/instrumentation/README.md#xhr-xmlhttprequest) |
| instrumentation-document-load | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) | Capture document load/navigation timing spans. | experimental | [Navigation Timing](./packages/instrumentation/README.md#navigation-timing) and [Resource Timing](./packages/instrumentation/README.md#resource-timing) (events) |
| instrumentation-long-task | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-long-task) | Capture Long Tasks API entries as spans. | experimental | No replacement planned |
| instrumentation-user-interaction | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-user-interaction) | Trace user interactions (e.g., clicks). | experimental | [User Action](./packages/instrumentation/README.md#user-action) (events) |
| plugin-react-load | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/plugin-react-load) | Instrument React application load/mount performance. | experimental | No replacement planned |

### SDK and Utilities (other repositories)

| Package | Location | Description | Status |
| --- | --- | --- | --- |
| opentelemetry-sdk-trace-web | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-web) | Browser tracing SDK (WebTracerProvider, web tracing setup). | stable |
| opentelemetry-browser-detector | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-browser-detector) | Resource detector for browser environment attributes. | experimental |
| web-common | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/web-common) | Shared utilities for browser/web instrumentations. | experimental |
| opentelemetry-context-zone | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-context-zone) | Zone.js-based context manager for maintaining trace context in browsers. | stable |
| auto-instrumentations-web | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/auto-instrumentations-web) | Bundle that auto-enables common web instrumentations. | experimental |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)


### Maintainers

- [David Luna](https://github.com/david-luna), Elastic
- [Jared Freeze](https://github.com/overbalance), Embrace
- [Joaquín Díaz](https://github.com/joaquin-diaz), Embrace
- [Martin Kuba](https://github.com/martinkuba), Grafana Labs
- [Wolfgang Therrien](https://github.com/wolfgangcodes), Honeycomb

For more information about the maintainer role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

### Approvers

- [Maxime Quentin](https://github.com/mquentin), Datadog

For more information about the approver role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).

### Emeritus

- [Benoît Zugmeyer](https://github.com/BenoitZugmeyer), Approver
- [Ted Young](https://github.com/tedsuo), Maintainer

For more information about the emeritus role, see the
[community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#emeritus-maintainerapprovertriager).

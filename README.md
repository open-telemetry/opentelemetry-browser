# <img src="https://opentelemetry.io/img/logos/opentelemetry-logo-nav.png" alt="OpenTelemetry Icon" width="45" height=""> OpenTelemetry Browser

## About

This repository is the home of OpenTelemetry Browser instrumentations and the future home of the OpenTelemetry Browser SDK.

This repo provides **event-based instrumentations** that emit events (structured log records) for browser performance and user interactions. These complement the existing **span-based instrumentations** maintained in the [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) and [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib) repositories.

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

For detailed configuration options, see the [instrumentation package README](./packages/instrumentation/README.md).

### More examples

For a more complete setup combining event-based instrumentations from this repository with span-based instrumentations from [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) and [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib), see the [examples](./examples/) directory.

## Browser Packages

The following tables list browser-related packages across all OpenTelemetry JS repositories.

### Packages in this repository

| Package | Description | Status |
| --- | --- | --- |
| [@opentelemetry/browser-instrumentation](./packages/instrumentation) | Event-based browser instrumentations (navigation timing, user actions, web vitals). | experimental |

### Event-based instrumentations (other repositories)

| Package | Location | Description | Status |
| --- | --- | --- | --- |
| instrumentation-browser-navigation | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-browser-navigation) | Capture browser navigation events (SPA route changes). | experimental |
| instrumentation-web-exception | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-web-exception) | Capture unhandled exceptions and promise rejections. | experimental |

### Span-based instrumentations (other repositories)

| Package | Location | Description | Status |
| --- | --- | --- | --- |
| opentelemetry-instrumentation-fetch | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-fetch) | Instrumentation for the Fetch API. | experimental |
| opentelemetry-instrumentation-xml-http-request | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-xml-http-request) | Instrumentation for XMLHttpRequest. | experimental |
| instrumentation-document-load | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) | Capture document load/navigation timing spans. | experimental |
| instrumentation-long-task | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-long-task) | Capture Long Tasks API entries as spans. | experimental |
| instrumentation-user-interaction | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-user-interaction) | Trace user interactions (e.g., clicks). | experimental |
| plugin-react-load | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/plugin-react-load) | Instrument React application load/mount performance. | experimental |

### SDK and Utilities (other repositories)

| Package | Location | Description | Status |
| --- | --- | --- | --- |
| opentelemetry-sdk-trace-web | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-web) | Browser tracing SDK (WebTracerProvider, web tracing setup). | stable |
| opentelemetry-browser-detector | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-browser-detector) | Resource detector for browser environment attributes. | experimental |
| web-common | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/web-common) | Shared utilities for browser/web instrumentations. | experimental |
| opentelemetry-context-zone | [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-context-zone) | Zone.js-based context manager for maintaining trace context in browsers. | stable |
| auto-instrumentations-web | [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/auto-instrumentations-web) | Bundle that auto-enables common web instrumentations. | experimental |

## Contributing

### Prerequisites

Contributing to this project requires **Node.js >= 24** and **npm ^11.9.0**

```bash
npm install -g npm@11
```

### Maintainers

- [David Luna](https://github.com/david-luna), Elastic
- [Jared Freeze](https://github.com/overbalance), Embrace
- [Joaquín Díaz](https://github.com/joaquin-diaz), Embrace
- [Martin Kuba](https://github.com/martinkuba), Grafana Labs
- [Wolfgang Therrien](https://github.com/wolfgangcodes), Honeycomb

For more information about the maintainer role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

### Approvers

- [Benoît Zugmeyer](https://github.com/BenoitZugmeyer), DataDog

For more information about the approver role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).

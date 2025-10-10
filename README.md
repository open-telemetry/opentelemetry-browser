# <img src="https://opentelemetry.io/img/logos/opentelemetry-logo-nav.png" alt="OpenTelemetry Icon" width="45" height=""> OpenTelemetry Browser

## About

This repository is intended to be the central home for the OpenTelemetry Browser SDK.

Note: At present, web instrumentation packages are maintained in the JavaScript SDK repository or the JavaScript Contrib repository:
- [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)
- [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)

See the [Packages](#packages) section below for a list of browser-related packages.

## Quick Start

### Installation

```bash
npm install @opentelemetry/sdk-trace-web \
  @opentelemetry/opentelemetry-browser-detector \
  @opentelemetry/instrumentation \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/instrumentation-fetch \
  @opentelemetry/instrumentation-xml-http-request
```

### Basic example

```js
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { resourceFromAttributes, detectResources } from '@opentelemetry/resources';
import { browserDetector } from '@opentelemetry/opentelemetry-browser-detector';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';

// configure resources
let resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'my-app',
});
let detectedResources = await detectResources({detectors:[browserDetector]});
resource = resource.merge(detectedResources);

// configure exporter
const exporter = new OTLPTraceExporter({
  url: '<opentelemetry-collector-url>'
});

// initialize trace provider
const provider = new WebTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(exporter)]
});
provider.register();

// Registering instrumentations
registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation(),
    new XMLHttpRequestInstrumentation()
  ],
});
```

## Packages

The following tables list browser-related packages, where they live today, and their intent.

### SDK and Utilities

| Package | Location | Intent | Status |
| --- | --- | --- | --- |
| opentelemetry-sdk-trace-web | [opentelemetry-js/packages/opentelemetry-sdk-trace-web](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-web) | Browser tracing SDK (WebTracerProvider, web tracing setup). | stable |
| opentelemetry-browser-detector | [opentelemetry-js/experimental/packages/opentelemetry-browser-detector](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-browser-detector) | Resource detector for browser environment attributes. | experimental |
| web-common | [opentelemetry-js/experimental/packages/web-common](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/web-common) | Shared utilities for browser/web instrumentations. | experimental |
| opentelemetry-context-zone | [opentelemetry-js/packages/opentelemetry-context-zone](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-context-zone) | Zone.js-based context manager for maintaining trace context in browsers. | stable |
| auto-instrumentations-web | [opentelemetry-js-contrib/packages/auto-instrumentations-web](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/auto-instrumentations-web) | Bundle that auto-enables common web instrumentations. | experimental |

### Instrumentations

| Package | Location | Intent | Status |
| --- | --- | --- | --- |
| opentelemetry-instrumentation-fetch | [opentelemetry-js/experimental/packages/opentelemetry-instrumentation-fetch](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-fetch) | Instrumentation for the Fetch API. | experimental |
| opentelemetry-instrumentation-xml-http-request | [opentelemetry-js/experimental/packages/opentelemetry-instrumentation-xml-http-request](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-xml-http-request) | Instrumentation for XMLHttpRequest. | experimental |
| instrumentation-document-load | [opentelemetry-js-contrib/packages/instrumentation-document-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) | Capture document load/navigation timing spans. | experimental |
| instrumentation-long-task | [opentelemetry-js-contrib/packages/instrumentation-long-task](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-long-task) | Capture Long Tasks API entries as spans. | experimental |
| instrumentation-user-interaction | [opentelemetry-js-contrib/packages/instrumentation-user-interaction](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-user-interaction) | Trace user interactions (e.g., clicks). | experimental |
| plugin-react-load | [opentelemetry-js-contrib/packages/plugin-react-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/plugin-react-load) | Instrument React application load/mount performance. | experimental |

## Contributing

### Maintainers

- TODO

For more information about the maintainer role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

### Approvers

- TODO

For more information about the approver role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).

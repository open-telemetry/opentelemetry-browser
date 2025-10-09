# <img src="https://opentelemetry.io/img/logos/opentelemetry-logo-nav.png" alt="OpenTelemetry Icon" width="45" height=""> OpenTelemetry Browser

## About

This repository is intended to be the central home for the OpenTelemetry Browser SDK.

Note: At present, web instrumentation packages are maintained in the JavaScript SDK repository or the JavaScript Contrib repository:
- [opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)
- [opentelemetry-js-contrib](https://github.com/open-telemetry/opentelemetry-js-contrib)

See the [Packages](#packages) section below for a list of browser-related packages.

## Quick Start



## Packages

The following tables list browser-related packages, where they live today, and their intent.

### SDK and Utilities

| Package | Location | Intent |
| --- | --- | --- |
| opentelemetry-sdk-trace-web | [opentelemetry-js/packages/opentelemetry-sdk-trace-web](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-sdk-trace-web) | Browser tracing SDK (WebTracerProvider, web tracing setup). |
| opentelemetry-browser-detector (experimental) | [opentelemetry-js/experimental/packages/opentelemetry-browser-detector](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-browser-detector) | Resource detector for browser environment attributes. |
| web-common (experimental) | [opentelemetry-js/experimental/packages/web-common](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/web-common) | Shared utilities for browser/web instrumentations. |
| opentelemetry-context-zone | [opentelemetry-js/packages/opentelemetry-context-zone](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-context-zone) | Zone.js-based context manager for maintaining trace context in browsers. |
| auto-instrumentations-web | [opentelemetry-js-contrib/packages/auto-instrumentations-web](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/auto-instrumentations-web) | Bundle that auto-enables common web instrumentations. |

### Instrumentations

| Package | Location | Intent |
| --- | --- | --- |
| opentelemetry-instrumentation-fetch (experimental) | [opentelemetry-js/experimental/packages/opentelemetry-instrumentation-fetch](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-fetch) | Instrumentation for the Fetch API. |
| opentelemetry-instrumentation-xml-http-request (experimental) | [opentelemetry-js/experimental/packages/opentelemetry-instrumentation-xml-http-request](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental/packages/opentelemetry-instrumentation-xml-http-request) | Instrumentation for XMLHttpRequest. |
| instrumentation-document-load | [opentelemetry-js-contrib/packages/instrumentation-document-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-document-load) | Capture document load/navigation timing spans. |
| instrumentation-long-task | [opentelemetry-js-contrib/packages/instrumentation-long-task](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-long-task) | Capture Long Tasks API entries as spans. |
| instrumentation-user-interaction | [opentelemetry-js-contrib/packages/instrumentation-user-interaction](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/instrumentation-user-interaction) | Trace user interactions (e.g., clicks). |
| plugin-react-load | [opentelemetry-js-contrib/packages/plugin-react-load](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/packages/plugin-react-load) | Instrument React application load/mount performance. |

## Contributing

### Maintainers

- TODO

For more information about the maintainer role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#maintainer).

### Approvers

- TODO

For more information about the approver role, see the [community repository](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md#approver).

# OpenTelemetry UserAction Instrumentation for web

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for *user actions* for Web applications, which may be loaded using the [`@opentelemetry/sdk-logs`](https://www.npmjs.com/package/@opentelemetry/sdk-logs) package.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

## Installation

```bash
npm install @opentelemetry/instrumentation-user-action
```

## Usage

### Initialize

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { UserActionInstrumentation } from '@opentelemetry/instrumentation-user-action';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new UserActionInstrumentation(),
  ],
});

// Add a button to click
const btn1 = document.createElement('button');
btn1.append(document.createTextNode('btn1'));

document.querySelector('body').append(btn1);

// now click on button to see user action logs
```

### Configuration

By default the instrumentation captures `mousedown`. You can configure which events to capture by passing an options object to the `UserActionInstrumentation` constructor:

```typescript
new UserActionInstrumentation({
  autoCapturedActions: [], // default is ['mousedown']
});
```

### Additional Attributes

Data attributes with the prefix `data-otel-` on the target element of the user action event will be added as additional attributes to the generated log record. For example, the following button:

```html
<button id="btn1" data-otel-user-id="12345" data-otel-feature="signup">
  Sign Up
</button>
```

## Semantic Conventions

This package does not currently generate any attributes from semantic conventions.

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-user-action
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-user-action.svg
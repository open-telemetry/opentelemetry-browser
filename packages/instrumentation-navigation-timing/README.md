# OpenTelemetry NavigationTiming Instrumentation for web

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for *navigation timing* for Web applications.

## Installation

```bash
npm install @opentelemetry/instrumentation-navigation-timing
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
import { NavigationTimingInstrumentation } from '@opentelemetry/instrumentation-navigation-timing';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new NavigationTimingInstrumentation(),
  ],
});
```

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-navigation-timing
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-navigation-timing.svg

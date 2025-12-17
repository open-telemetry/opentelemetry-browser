# OpenTelemetry Console Instrumentation for Web

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for *console* methods (log, warn, error, info, debug) for Web applications, emitting them as OpenTelemetry logs which may be collected using the [`@opentelemetry/sdk-logs`](https://www.npmjs.com/package/@opentelemetry/sdk-logs) package.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

## Installation


```bash
npm install @opentelemetry/instrumentation-console
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
import { ConsoleInstrumentation } from '@opentelemetry/instrumentation-console';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new ConsoleInstrumentation(),
  ],
});

// Now all console calls will be captured as OpenTelemetry logs
console.log('Hello, World!');
console.error('Something went wrong!');
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logMethods` | `ConsoleMethod[]` | `['log', 'warn', 'error', 'info', 'debug']` | Console methods to instrument |
| `messageSerializer` | `(args: unknown[]) => string` | See below | Custom serializer for console arguments |

### logMethods

Configure which console methods to instrument:

```typescript
new ConsoleInstrumentation({
  logMethods: ['error', 'warn'], // Only capture errors and warnings
});
```

### messageSerializer

Provide a custom serializer for console arguments:

```typescript
new ConsoleInstrumentation({
  messageSerializer: (args) => args.map(arg => String(arg)).join(' | '),
});
```

The default serializer joins arguments as strings, with objects serialized via `JSON.stringify`. Circular references are handled gracefully by falling back to `String(arg)`.

## Severity Mapping

Console methods are mapped to OpenTelemetry severity levels:

| Console Method | SeverityNumber | SeverityText |
|----------------|----------------|--------------|
| `debug` | DEBUG (5) | 'debug' |
| `log` | INFO (9) | 'log' |
| `info` | INFO (9) | 'info' |
| `warn` | WARN (13) | 'warn' |
| `error` | ERROR (17) | 'error' |

## Semantic Conventions

This package emits logs with the following attributes:

| Attribute | Description |
|-----------|-------------|
| `browser.console.method` | The console method that was called (e.g., 'log', 'error') |

Event name: `browser.console`

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-console
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-console.svg

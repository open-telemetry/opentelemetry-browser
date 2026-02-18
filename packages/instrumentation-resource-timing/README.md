# OpenTelemetry ResourceTiming Instrumentation for web

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

This module provides automatic instrumentation for *resource timing* for Web applications, capturing performance metrics for all resources loaded by the browser (scripts, stylesheets, images, fonts, XHR/fetch requests, etc.).

## Features

- 🚀 **Performance-Optimized**: Uses `requestIdleCallback` to avoid blocking the main thread
- 📦 **Batched Emissions**: Processes resources in configurable batches to prevent overload
- 🦺 **Safari Compatible**: Automatic fallback for browsers without `requestIdleCallback`
- 🎯 **Buffered Mode**: Captures historical resources loaded before instrumentation was enabled

## Installation

```bash
npm install @opentelemetry/instrumentation-resource-timing
```

## Usage

### Basic Usage

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { ResourceTimingInstrumentation } from '@opentelemetry/instrumentation-resource-timing';
import { registerInstrumentations } from '@opentelemetry/instrumentation';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new ResourceTimingInstrumentation(),
  ],
});
```

### Advanced Configuration

```typescript
registerInstrumentations({
  instrumentations: [
    new ResourceTimingInstrumentation({
      // Process 100 resources per batch (default: 50)
      batchSize: 100,

      // Wait max 2 seconds for idle time before forcing processing (default: 1000)
      forceProcessingAfter: 2000,

      // Spend max 100ms processing per idle callback (default: 50)
      maxProcessingTime: 100,

      // Maximum queue size before forcing immediate flush (default: 1000)
      maxQueueSize: 2000,
    }),
  ],
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | `number` | `50` | Number of resources to process per batch. Lower values reduce memory pressure but increase overhead. |
| `forceProcessingAfter` | `number` | `1000` | Maximum time (ms) to wait for an idle callback before forcing processing. Ensures resources are eventually emitted even if the browser never idles. |
| `maxProcessingTime` | `number` | `50` | Maximum time (ms) to spend processing resources per idle callback. Prevents blocking the main thread. |
| `maxQueueSize` | `number` | `1000` | Maximum number of resources to queue before forcing immediate flush. Prevents memory issues during extreme bursts. When reached, the queue is flushed immediately. |

## How It Works

### 1. **Post-Load Observation**
The instrumentation waits for the `load` event before setting up the `PerformanceObserver`. This ensures the page has fully loaded and we capture resources using buffered mode.

### 2. **Buffered Mode**
Using `{ buffered: true }` allows the observer to capture historical resource timing entries that occurred before the observer was created.

### 3. **Idle Scheduling**
Resources are processed during browser idle time using `requestIdleCallback` (with automatic fallback to `setTimeout` for Safari).

### 4. **Time-Budgeted Processing**
Resources are processed in chunks (default: 50 per idle callback) with a maximum processing time (default: 50ms) to ensure the main thread remains responsive.

### 5. **OTel Standard Emission**
Each resource emits **one log event**. Network batching is handled by OTel's `BatchLogRecordProcessor` for efficient transport.

### 6. **Visibility Change Handling**
When the page becomes hidden (tab switch, navigation), all pending resources are immediately flushed to prevent data loss.

## Captured Data

Each resource timing event includes:

- **URL** - The resource URL
- **Initiator Type** - How the resource was initiated (script, css, img, xmlhttprequest, fetch, etc.)
- **Duration** - Total resource load time
- **Timing Phases** - DNS lookup, TCP connection, TLS handshake, request, response
- **Size Metrics** - Transfer size, encoded size, decoded size
- **Protocol** - HTTP version (h1, h2, h3)
- **Redirect Info** - Redirect timing if applicable
- **Service Worker** - Worker start time if intercepted
- **Render Blocking** - Whether the resource blocked rendering (newer browsers)

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| PerformanceObserver | ✅ 52+ | ✅ 57+ | ✅ 11+ | ✅ 79+ |
| Buffered Mode | ✅ 89+ | ✅ 68+ | ✅ 15.4+ | ✅ 89+ |
| requestIdleCallback | ✅ 47+ | ✅ 55+ | ❌ Fallback | ✅ 79+ |

**Note**: Safari doesn't support `requestIdleCallback`, but this instrumentation automatically falls back to `setTimeout` for graceful degradation.

## Performance Considerations

### Memory Usage
- **Batching**: Processes resources in chunks to avoid holding large arrays in memory
- **Queue Limit**: Max 1000 resources queued (configurable). Queue is force-flushed when limit is reached, preventing memory exhaustion
- **Force Flush**: When queue fills, all entries are immediately emitted (bypassing idle scheduling) to ensure no data loss

### Main Thread Impact
- **Idle Processing**: Uses browser idle time to avoid blocking user interactions
- **Time Budget**: Respects idle deadline and max processing time to maintain responsiveness
- **Forced Processing**: If browser never idles, forces processing after `forceProcessingAfter` (default: 1000ms) to ensure data is captured
- **Adaptive**: Processes fewer resources when `timeRemaining()` is low during forced execution
- **Visibility Change**: Flushes pending entries when page becomes hidden (tab switch, navigation) to prevent data loss

### Network Impact
- **OTel Batching**: Log events are batched by `BatchLogRecordProcessor` for efficient network transmission
- **Standard Compliance**: Each resource is a separate log event following OTel semantics

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For Resource Timing API: <https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/instrumentation-resource-timing
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Finstrumentation-resource-timing.svg

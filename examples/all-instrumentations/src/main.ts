import './style.css';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

const loggerProvider = new LoggerProvider({
  processors: [new SimpleLogRecordProcessor(new ConsoleLogRecordExporter())],
});

logs.setGlobalLoggerProvider(loggerProvider);

registerInstrumentations({
  instrumentations: [
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation({ includeRawAttribution: true }),
  ],
});

// Use /api proxy (same-origin) so the browser exposes full timing data.
// Cross-origin requests hide DNS, connect, TLS, and size details unless
// the server sends Timing-Allow-Origin.

document.getElementById('xhr-button')?.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', '/api/get');
  xhr.send();
});

document.getElementById('fetch-button')?.addEventListener('click', () => {
  fetch('/api/get');
});

document.getElementById('img-button')?.addEventListener('click', () => {
  const img = document.createElement('img');
  // httpbin /image/png returns a PNG; loaded via same-origin proxy
  img.src = `/api/image/png?cachebust=${Date.now()}`;
  img.style.display = 'none';
  document.body.appendChild(img);
});

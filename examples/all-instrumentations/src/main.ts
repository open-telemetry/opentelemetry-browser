import './style.css';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
} from '@opentelemetry/browser-sdk/session';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

// ── Sessions ────────────────────────────────────────────────────────────────
// The session processors must run BEFORE the export processors so the
// session.id attribute is set on each log record before it is exported.
const sessionManager = createSessionManager({
  sessionIdGenerator: createDefaultSessionIdGenerator(),
  sessionStore: createLocalStorageSessionStore(),
  // 4h ceiling, 30min of inactivity rotates the session.
  maxDuration: 4 * 60 * 60,
  inactivityTimeout: 30 * 60,
});
await sessionManager.start();

const loggerProvider = new LoggerProvider({
  processors: [
    createSessionLogRecordProcessor(sessionManager),
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});

logs.setGlobalLoggerProvider(loggerProvider);

registerInstrumentations({
  instrumentations: [
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation({
      initiatorTypes: ['xmlhttprequest', 'fetch'],
    }),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation({ includeRawAttribution: true }),
  ],
});

document.getElementById('xhr-button')?.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://httpbin.org/get');
  xhr.send();
});

document.getElementById('fetch-button')?.addEventListener('click', () => {
  fetch('https://httpbin.org/get');
});

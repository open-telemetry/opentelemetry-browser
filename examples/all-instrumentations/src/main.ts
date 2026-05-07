import './style.css';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import {
  createSessionEntity,
  EntityAwareLoggerProvider,
  trackDocument,
} from '@opentelemetry/browser-sdk/experimental/entities';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  ConsoleLogRecordExporter,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionManager,
} from '@opentelemetry/web-common';

type SessionManager = ReturnType<typeof createSessionManager>;

const SESSION_STORAGE_KEY = 'opentelemetry-session';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.VERBOSE);

const baseResource = resourceFromAttributes({
  'service.name': 'examples-all-instrumentations',
  'service.version': '0.0.0',
});

const loggerProvider = new EntityAwareLoggerProvider({
  resource: baseResource,
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
    new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: 'http://localhost:4318/v1/logs' }),
    ),
  ],
});

logs.setGlobalLoggerProvider(loggerProvider);

// ── Session entity (via @opentelemetry/web-common SessionManager) ──────────
const buildSessionManager = (): SessionManager =>
  createSessionManager({
    sessionIdGenerator: createDefaultSessionIdGenerator(),
    sessionStore: createLocalStorageSessionStore(),
    maxDuration: 7200,
    inactivityTimeout: 1800,
  });

let sessionManager = buildSessionManager();

const installSessionObserver = () => {
  sessionManager.addObserver({
    onSessionStarted: (session) => {
      loggerProvider.setEntity(createSessionEntity(session.id));
      updateStatus();
    },
    onSessionEnded: () => {
      // No-op: the session entity is replaced by onSessionStarted on rotation.
    },
  });
};
installSessionObserver();
void sessionManager.start();

// ── Document entity ─────────────────────────────────────────────────────────
const documentTracker = trackDocument(loggerProvider);
documentTracker.addObserver(() => updateStatus());

// ── Auto-instrumentations ───────────────────────────────────────────────────
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

// ── UI wiring ───────────────────────────────────────────────────────────────
const status = document.getElementById('status');
const updateStatus = () => {
  if (!status) {
    return;
  }
  status.textContent = `session.id=${sessionManager.getSessionId() ?? '<none>'} · browser.document.url.full=${documentTracker.getHref()}`;
};
updateStatus();

document.getElementById('xhr-button')?.addEventListener('click', () => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'https://httpbin.org/get');
  xhr.send();
});

document.getElementById('fetch-button')?.addEventListener('click', () => {
  void fetch('https://httpbin.org/get');
});

document
  .getElementById('push-history-button')
  ?.addEventListener('click', () => {
    const next = `${window.location.pathname}?n=${Math.floor(Math.random() * 1000)}`;
    history.pushState({}, '', next);
  });

document
  .getElementById('rotate-session-button')
  ?.addEventListener('click', () => {
    sessionManager.shutdown();
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionManager = buildSessionManager();
    installSessionObserver();
    void sessionManager.start();
  });

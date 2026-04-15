// actions.ts — handlers for each demo button

import type { Tracer } from '@opentelemetry/api';
import { SpanStatusCode } from '@opentelemetry/api';
import type { Logger } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createActions(tracer: Tracer, logger: Logger) {
  // ── Trace actions ───────────────────────────────────────────────────────────

  const fetchOk = async () => {
    const url = 'https://jsonplaceholder.typicode.com/posts/1';
    try {
      const r = await fetch(url);
      await r.json();
    } catch {
      // instrumentation handles the span
    }
  };

  const fetch404 = async () => {
    const url = 'https://jsonplaceholder.typicode.com/posts/999999';
    try {
      await fetch(url);
    } catch {
      // instrumentation handles the span
    }
  };

  const fetchNetErr = async () => {
    const url = 'https://this-host-definitely-does-not-exist.invalid/api/data';
    try {
      await fetch(url);
    } catch {
      // instrumentation handles the span
    }
  };

  const xhr = () => {
    const url = 'https://jsonplaceholder.typicode.com/users/1';
    const req = new XMLHttpRequest();
    req.open('GET', url);
    req.send();
  };

  const jsError = () => {
    const errorSpan = tracer.startSpan('js-error-event');
    try {
    // @ts-expect-error generating an error on purpose
    void {}.undefinedProperty;
    } catch (e) {
      errorSpan.recordException(e as Error);
      errorSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: (e as Error).message,
      });
    } finally {
      errorSpan.end();
    }
  };

  const navigation = () => {
    const routes = [
      '/home',
      '/about',
      '/dashboard',
      '/settings',
      '/profile',
      '/search',
    ];
    const to = routes[Math.floor(Math.random() * routes.length)] ?? '/';

    history.pushState({ page: to }, '', `${to}?otelDemo=1`);

    const span = tracer.startSpan('navigation');
    span.setAttribute('navigation.to', to);
    span.setAttribute('navigation.type', 'pushState');
    span.setAttribute('navigation.from', document.referrer || '/');
    span.end();
  };

  const customSpan = async () => {
    const span = tracer.startSpan('user-interaction');
    span.setAttribute('interaction.type', 'button-click');
    span.setAttribute('interaction.component', 'custom-span-button');
    span.setAttribute('interaction.timestamp', Date.now());
    await sleep(80 + Math.random() * 120);
    span.end();
  };

  const nestedSpans = async () => {
    const root = tracer.startSpan('workflow.execute');
    root.setAttribute('workflow.name', 'demo-pipeline');
    root.setAttribute('workflow.steps', 3);

    await sleep(40);

    const rootCtx = trace.setSpan(context.active(), root);
    const stepNames = ['validate', 'process', 'commit'];
    for (const [i, name] of stepNames.entries()) {
      await context.with(rootCtx, async () => {
        const step = tracer.startSpan(`workflow.step-${i + 1}`);
        step.setAttribute('step.index', i + 1);
        step.setAttribute('step.name', name);
        await sleep(50 + (i + 1) * 30);
        step.end();
      });
    }

    root.end();
  };

  // ── Log actions ─────────────────────────────────────────────────────────────

  const logInfo = () => {
    logger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: 'User triggered an info log event',
      attributes: { 'log.source': 'manual', 'event.name': 'demo.log_info' },
    });
  };

  const logWarn = () => {
    logger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: 'User triggered a warning log event',
      attributes: { 'log.source': 'manual', 'event.name': 'demo.log_warn' },
    });
  };

  const logError = () => {
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: 'User triggered an error log event',
      attributes: {
        'log.source': 'manual',
        'event.name': 'demo.log_error',
        'error.type': 'DemoError',
      },
    });
  };

  return {
    fetchOk,
    fetch404,
    fetchNetErr,
    xhr,
    jsError,
    navigation,
    customSpan,
    nestedSpans,
    logInfo,
    logWarn,
    logError,
  };
}

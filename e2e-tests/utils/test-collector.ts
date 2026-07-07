import type { HttpHandler } from 'msw';
import { HttpResponse, http } from 'msw';
import { setupWorker } from 'msw/browser';

export const COLLECTOR_URL = 'http://localhost:4318/v1/traces';
export const LOGS_COLLECTOR_URL = 'http://localhost:4318/v1/logs';

// ── OTLP JSON types ────────────────────────────────────────────────────────────

interface OtlpAnyValue {
  stringValue?: string;
  intValue?: number;
  boolValue?: boolean;
  doubleValue?: number;
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  events: Array<{
    name: string;
    timeUnixNano: string;
    attributes: OtlpKeyValue[];
  }>;
  status: { code: number; message?: string };
}

export interface OtlpLogRecord {
  traceId?: string;
  spanId?: string;
  severityNumber?: number;
  severityText?: string;
  attributes: OtlpKeyValue[];
}

interface ExportTraceServiceRequest {
  resourceSpans: Array<{
    resource: { attributes: OtlpKeyValue[] };
    scopeSpans: Array<{
      scope: { name: string; version?: string };
      spans: OtlpSpan[];
    }>;
  }>;
}

interface ExportLogsServiceRequest {
  resourceLogs: Array<{
    resource: { attributes: OtlpKeyValue[] };
    scopeLogs: Array<{
      scope: { name: string; version?: string };
      logRecords: OtlpLogRecord[];
    }>;
  }>;
}

// ── MSW worker (singleton) ─────────────────────────────────────────────────────

let worker: ReturnType<typeof setupWorker> | undefined;

export async function startMsw(...handlers: HttpHandler[]): Promise<void> {
  worker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: 'error', quiet: true });
}

export function stopMsw(): void {
  worker?.stop();
  worker = undefined;
}

// ── Test collector ─────────────────────────────────────────────────────────────

export interface TestCollector {
  getSpans: () => OtlpSpan[];
  getLogs: () => OtlpLogRecord[];
  cleanup: () => void;
}

export function setupCollector(): TestCollector {
  const tracePayloads: ExportTraceServiceRequest[] = [];
  const logPayloads: ExportLogsServiceRequest[] = [];

  worker?.use(
    http.post(COLLECTOR_URL, async ({ request }) => {
      const payload = (await request.json()) as ExportTraceServiceRequest;
      tracePayloads.push(payload);
      return HttpResponse.json({});
    }),
    http.post(LOGS_COLLECTOR_URL, async ({ request }) => {
      const payload = (await request.json()) as ExportLogsServiceRequest;
      logPayloads.push(payload);
      return HttpResponse.json({});
    }),
  );

  return {
    getSpans: () =>
      tracePayloads.flatMap((p) =>
        p.resourceSpans.flatMap((rs) =>
          rs.scopeSpans.flatMap((ss) => ss.spans),
        ),
      ),
    getLogs: () =>
      logPayloads.flatMap((p) =>
        p.resourceLogs.flatMap((rl) =>
          rl.scopeLogs.flatMap((sl) => sl.logRecords),
        ),
      ),
    cleanup: () => {
      tracePayloads.length = 0;
      logPayloads.length = 0;
      worker?.resetHandlers();
    },
  };
}

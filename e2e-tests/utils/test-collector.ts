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
  eventName?: string;
  body?: OtlpAnyValue;
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

// ── Internal singleton state ───────────────────────────────────────────────────

let worker: ReturnType<typeof setupWorker> | undefined;
let tracePayloads: ExportTraceServiceRequest[] = [];
let logPayloads: ExportLogsServiceRequest[] = [];

// ── Collector ─────────────────────────────────────────────────────────────────

export const collector = {
  /** Start MSW and intercept OTLP exports. Call once in beforeAll. */
  async start(): Promise<void> {
    worker = setupWorker(
      http.post(COLLECTOR_URL, async ({ request }) => {
        tracePayloads.push((await request.json()) as ExportTraceServiceRequest);
        return HttpResponse.json({});
      }),
      http.post(LOGS_COLLECTOR_URL, async ({ request }) => {
        logPayloads.push((await request.json()) as ExportLogsServiceRequest);
        return HttpResponse.json({});
      }),
    );
    await worker.start({ onUnhandledRequest: 'error', quiet: true });
  },

  /** Stop MSW and discard all captured data. Call once in afterAll. */
  stop(): void {
    worker?.stop();
    worker = undefined;
    tracePayloads = [];
    logPayloads = [];
  },

  /**
   * Clear captured payloads and remove any runtime handlers added via `use()`.
   * Call in afterEach to isolate tests.
   */
  reset(): void {
    tracePayloads.length = 0;
    logPayloads.length = 0;
    worker?.resetHandlers();
  },

  /** Add runtime MSW handlers for the current test (cleared by reset()). */
  use(...handlers: HttpHandler[]): void {
    worker?.use(...handlers);
  },

  getSpans(): OtlpSpan[] {
    return tracePayloads.flatMap((p) =>
      p.resourceSpans.flatMap((rs) => rs.scopeSpans.flatMap((ss) => ss.spans)),
    );
  },

  getLogs(): OtlpLogRecord[] {
    return logPayloads.flatMap((p) =>
      p.resourceLogs.flatMap((rl) =>
        rl.scopeLogs.flatMap((sl) => sl.logRecords),
      ),
    );
  },
};

// otlp-types.ts — OTLP/HTTP JSON shapes shared by the e2e test collector
// (test-collector.ts) and the sandbox mock intake (sandbox/src/mocks). Types
// only — no runtime imports — so either workspace can consume them freely.

export interface OtlpAnyValue {
  stringValue?: string;
  // int64 is serialized as a string in OTLP/HTTP JSON.
  intValue?: string | number;
  boolValue?: boolean;
  doubleValue?: number;
  arrayValue?: { values?: OtlpAnyValue[] };
  kvlistValue?: { values?: OtlpKeyValue[] };
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAnyValue;
}

export interface OtlpScope {
  name: string;
  version?: string;
}

export interface OtlpResource {
  attributes: OtlpKeyValue[];
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
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: OtlpAnyValue;
  attributes: OtlpKeyValue[];
}

export interface ExportTraceServiceRequest {
  resourceSpans: Array<{
    resource: OtlpResource;
    scopeSpans: Array<{ scope: OtlpScope; spans: OtlpSpan[] }>;
  }>;
}

export interface ExportLogsServiceRequest {
  resourceLogs: Array<{
    resource: OtlpResource;
    scopeLogs: Array<{ scope: OtlpScope; logRecords: OtlpLogRecord[] }>;
  }>;
}

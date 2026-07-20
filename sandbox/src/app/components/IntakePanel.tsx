// IntakePanel.tsx — "what the collector received", decoded from the OTLP/HTTP
// payloads intercepted by the mock intake (see src/mocks/).

import { useEffect, useMemo, useState } from 'react';
import type { IntakeRecord, IntakeRequest } from '../../mocks/intake-bus.ts';
import { onIntake, toCollectorDebug } from '../../mocks/intake-bus.ts';

type RequestView = 'none' | 'collector' | 'raw';

const MAX_REQUESTS = 50;

function shortId(id?: string, n = 8): string {
  return id ? `${id.slice(0, n)}…` : '—';
}

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

// Group records under their instrumentation scope for display.
function byScope(records: IntakeRecord[]): [string, IntakeRecord[]][] {
  const map = new Map<string, IntakeRecord[]>();
  for (const r of records) {
    const list = map.get(r.scope) ?? [];
    list.push(r);
    map.set(r.scope, list);
  }
  return [...map.entries()];
}

function RecordRow({ record }: { record: IntakeRecord }) {
  const icon =
    record.kind === 'log' ? '◆' : record.status === 'error' ? '✗' : '●';
  return (
    <div className={`intake-record ${record.status}`}>
      <span className="intake-icon">{icon}</span>
      <span className="intake-name">{record.name}</span>
      <span className="intake-detail">{record.detail}</span>
      {record.traceId && (
        <span className="intake-tag">trace={shortId(record.traceId)}</span>
      )}
      {record.sessionId && (
        <span className="intake-chip">session={shortId(record.sessionId)}</span>
      )}
    </div>
  );
}

function RequestCard({ req }: { req: IntakeRequest }) {
  const [view, setView] = useState<RequestView>('none');
  const scopes = useMemo(() => byScope(req.records), [req.records]);
  const toggle = (v: RequestView) => setView((cur) => (cur === v ? 'none' : v));
  const path = (() => {
    try {
      return new URL(req.url).pathname;
    } catch {
      return req.url;
    }
  })();

  return (
    <details className="intake-req">
      <summary>
        <span className="intake-time">{timeOf(req.at)}</span>
        <span className={`intake-badge ${req.signal}`}>{req.signal}</span>
        <span className="intake-summary-text">
          POST {path} · {req.records.length}{' '}
          {req.signal === 'traces' ? 'span' : 'log'}
          {req.records.length === 1 ? '' : 's'} · {fmtBytes(req.bytes)}
        </span>
      </summary>

      <div className="intake-resource">
        {Object.entries(req.resource).map(([k, v]) => (
          <span className="intake-tag" key={k}>
            {k}={String(v)}
          </span>
        ))}
      </div>

      {scopes.map(([scope, records]) => (
        <div className="intake-scope" key={scope}>
          <div className="intake-scope-name">— {scope} —</div>
          {records.map((r) => (
            <RecordRow key={`${r.spanId ?? r.name}-${r.detail}`} record={r} />
          ))}
        </div>
      ))}

      <div className="intake-views">
        <button
          type="button"
          className={`intake-raw-toggle ${view === 'collector' ? 'active' : ''}`}
          onClick={() => toggle('collector')}
        >
          collector debug view
        </button>
        <button
          type="button"
          className={`intake-raw-toggle ${view === 'raw' ? 'active' : ''}`}
          onClick={() => toggle('raw')}
        >
          raw OTLP JSON
        </button>
      </div>
      {view === 'collector' && (
        <pre className="intake-raw">{toCollectorDebug(req)}</pre>
      )}
      {view === 'raw' && (
        <pre className="intake-raw">{JSON.stringify(req.raw, null, 2)}</pre>
      )}
    </details>
  );
}

export function IntakePanel() {
  const [requests, setRequests] = useState<IntakeRequest[]>([]);

  useEffect(
    () =>
      onIntake((req) =>
        setRequests((prev) => [req, ...prev].slice(0, MAX_REQUESTS)),
      ),
    [],
  );

  const activeSession = requests
    .flatMap((r) => r.records)
    .find((r) => r.sessionId)?.sessionId;

  return (
    <article>
      <header>
        <strong>
          Intake received <small>({requests.length})</small>
        </strong>
        {activeSession && (
          <span className="intake-chip" style={{ marginLeft: '0.5rem' }}>
            session={shortId(activeSession)}
          </span>
        )}
        <button
          type="button"
          className="outline"
          style={{ marginLeft: '0.5rem' }}
          onClick={() => setRequests([])}
        >
          Clear
        </button>
      </header>
      <div className="intake-body">
        {requests.length === 0 ? (
          <p className="intake-empty">
            Waiting for OTLP exports… trigger an action to see what the
            collector would receive over the wire.
          </p>
        ) : (
          requests.map((req) => <RequestCard key={req.id} req={req} />)
        )}
      </div>
    </article>
  );
}

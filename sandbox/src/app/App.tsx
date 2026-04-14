import { useCallback, useEffect, useRef, useState } from 'react';
import { initOtel } from '../otel.ts';
import { createActions } from './actions.ts';
import { buildSnippet, LOG_ICONS } from './helpers.ts';
import { useConfig } from './use-config.ts';

interface LogEntry {
  id: number;
  type: string;
  msg: string;
  time: string;
}

export function App() {
  const cfg = useConfig();

  // ── SDK state ─────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('loading');
  const [statusMsg, setStatusMsg] = useState('Initialising SDK…');
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const actionsRef = useRef<ReturnType<typeof createActions> | null>(null);
  const logBodyRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const codeRef = useRef<HTMLDivElement>(null);

  // ── Log helper ────────────────────────────────────────────────────────────
  const addLog = useCallback((type: string, msg: string) => {
    const id = ++logIdRef.current;
    const time = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { id, type, msg, time }]);
  }, []);

  // ── Boot SDK once on mount ────────────────────────────────────────────────
  useEffect(() => {
    const config = {
      serviceName: cfg.initial.serviceName,
      serviceVersion: cfg.initial.serviceVersion,
      tracesUrl: cfg.initial.tracesUrl,
      logsUrl: cfg.initial.logsUrl,
    };
    const attrs = { ...cfg.initial.customAttributes };

    try {
      const handle = initOtel(config, attrs, {
        onSpan: (type, msg) => addLog(type, msg),
        onLog: (type, msg) => addLog(type, msg),
      });

      actionsRef.current = createActions(handle.tracer, handle.logger);
      setStatus('ok');
      setStatusMsg(`SDK ready · ${config.tracesUrl}`);
      setReady(true);

      addLog(
        'info',
        `SDK initialised — service="${config.serviceName}" v${config.serviceVersion}`,
      );
      addLog('info', `Traces → ${config.tracesUrl}`);
      addLog('info', `Logs   → ${config.logsUrl}`);
      if (Object.keys(attrs).length) {
        addLog('info', `Resource attrs → ${JSON.stringify(attrs)}`);
      }
      addLog('muted', 'Open DevTools → Console to see full span/log objects');
    } catch (err) {
      setStatus('error');
      setStatusMsg('SDK init failed — check console');
      addLog(
        'error',
        `SDK init error: ${err instanceof Error ? err.message : String(err)}`,
      );
      console.error('[OTel Sandbox] SDK init failed:', err);
    }
  }, [
    addLog,
    cfg.initial.customAttributes,
    cfg.initial.logsUrl,
    cfg.initial.serviceName,
    cfg.initial.serviceVersion,
    cfg.initial.tracesUrl,
  ]);

  // ── Auto-scroll log ───────────────────────────────────────────────────────
  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
    }
  }, []);

  // ── Syntax-highlighted code snippet (avoids dangerouslySetInnerHTML) ──────
  const snippet = buildSnippet(cfg.config, cfg.attrs);
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.innerHTML = snippet;
    }
  }, [snippet]);

  // ── Derived ───────────────────────────────────────────────────────────────
  function act(name: keyof ReturnType<typeof createActions>) {
    actionsRef.current?.[name]?.();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="container">
      <header>
        <hgroup>
          <h1>OTel Browser Instrumentation Sandbox</h1>
          <p>
            Interactive development environment for{' '}
            <code>@opentelemetry/browser-instrumentation</code>
          </p>
        </hgroup>
        <div className="status-pill">
          <span className={`status-dot ${status}`} />
          <small>{statusMsg}</small>
        </div>
      </header>

      <div className="two-col">
        {/* LEFT column */}
        <div className="left-col">
          {/* SDK Config */}
          <article>
            <header>
              <strong>SDK Config</strong>
            </header>
            <label>
              serviceName
              <input
                type="text"
                value={cfg.serviceName}
                onChange={cfg.updateField(cfg.setServiceName)}
                placeholder="my-frontend-app"
              />
            </label>
            <label>
              serviceVersion
              <input
                type="text"
                value={cfg.serviceVersion}
                onChange={cfg.updateField(cfg.setServiceVersion)}
                placeholder="1.0.0"
              />
            </label>
            <label>
              tracesUrl
              <input
                type="text"
                value={cfg.tracesUrl}
                onChange={cfg.updateField(cfg.setTracesUrl)}
                placeholder="http://localhost:4318/v1/traces"
              />
            </label>
            <label>
              logsUrl
              <input
                type="text"
                value={cfg.logsUrl}
                onChange={cfg.updateField(cfg.setLogsUrl)}
                placeholder="http://localhost:4318/v1/logs"
              />
            </label>

            {cfg.configDirty && (
              <p>
                <ins>Config changed — resource attributes are set at init.</ins>{' '}
                <button
                  type="button"
                  className="outline"
                  onClick={() => location.reload()}
                >
                  Reinit SDK
                </button>
              </p>
            )}

            <hr />
            <strong>Custom Attributes</strong>
            {cfg.customAttrs.map((attr, i) => (
              <div className="attr-row" key={attr.id}>
                <input
                  type="text"
                  value={attr.key}
                  onChange={(e) => cfg.updateAttr(i, 'key', e.target.value)}
                  placeholder="key"
                />
                <span>:</span>
                <input
                  type="text"
                  value={attr.val}
                  onChange={(e) => cfg.updateAttr(i, 'val', e.target.value)}
                  placeholder="value"
                />
                <button
                  type="button"
                  className="outline secondary"
                  onClick={() => cfg.removeAttr(i)}
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              type="button"
              className="outline btn-add-attr"
              style={{ marginLeft: '0.5rem' }}
              onClick={cfg.addAttr}
            >
              + Add attribute
            </button>
          </article>

          {/* Trace actions */}
          <article>
            <header>
              <strong>Traces</strong>
            </header>
            <div className="btn-grid">
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('fetchOk')}
                className="btn-resource"
              >
                ✅ Fetch 200
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('fetch404')}
                className="btn-err"
              >
                🐛 Fetch 404
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('fetchNetErr')}
                className="btn-err"
              >
                🔥 Net Error
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('xhr')}
                className="btn-resource"
              >
                📡 XHR
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('jsError')}
                className="btn-err"
              >
                💥 JS Error
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('navigation')}
                className="btn-resource"
              >
                🚀 Navigate
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('customSpan')}
                className="btn-resource"
              >
                ✨ Custom Span
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('nestedSpans')}
                className="btn-resource"
              >
                🔀 Nested Spans
              </button>
            </div>
          </article>

          {/* Log actions */}
          <article>
            <header>
              <strong>Logs</strong>
            </header>
            <div className="btn-grid">
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('logInfo')}
                className="btn-resource"
              >
                💡 Info
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('logWarn')}
                className="btn-resource"
              >
                🚧 Warn
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={() => act('logError')}
                className="btn-err"
              >
                🚨 Error
              </button>
            </div>
          </article>
        </div>

        {/* RIGHT column: code snippet */}
        <article>
          <header>
            <strong>Equivalent SDK init</strong>
          </header>
          <div className="code-block" ref={codeRef} />
        </article>
      </div>

      {/* Event Log */}
      <article>
        <header>
          <strong>
            Event Log <small>({logs.length})</small>
          </strong>
          <button
            type="button"
            className="outline"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => setLogs([])}
          >
            Clear
          </button>
        </header>
        <div className="log-body" ref={logBodyRef}>
          {logs.length === 0 && (
            <div className="log-entry">
              <span className="log-time">—</span>
              <span>·</span>
              <span className="log-msg-muted">Waiting for events…</span>
            </div>
          )}
          {logs.map((entry) => (
            <div className="log-entry" key={entry.id}>
              <span className="log-time">{entry.time}</span>
              <span>{LOG_ICONS[entry.type] ?? '·'}</span>
              <span className={`log-msg-${entry.type}`}>{entry.msg}</span>
            </div>
          ))}
        </div>
      </article>
    </main>
  );
}

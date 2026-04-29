import { useCallback, useEffect, useRef, useState } from 'react';
import { initOtel } from '../otel.ts';
import { createActions } from './actions.ts';
import { ActionsPanel } from './components/ActionsPanel.tsx';
import { CodeSnippet } from './components/CodeSnippet.tsx';
import type { LogEntry } from './components/EventLog.tsx';
import { EventLog } from './components/EventLog.tsx';
import { SandboxConfigForm } from './components/SandboxConfigForm.tsx';
import { useSandboxConfig } from './hooks/use-sandbox-config.ts';

export function App() {
  const cfg = useSandboxConfig();

  // ── SDK state ─────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('loading');
  const [statusMsg, setStatusMsg] = useState('Initialising SDK…');
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const actionsRef = useRef<ReturnType<typeof createActions> | null>(null);
  const logIdRef = useRef(0);

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
        onSpan: addLog,
        onLog: addLog,
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
        <div className="left-col">
          <SandboxConfigForm cfg={cfg} />
          <ActionsPanel ready={ready} act={act} />
        </div>

        <article>
          <header>
            <strong>Equivalent SDK init</strong>
          </header>
          <CodeSnippet config={cfg.config} attrs={cfg.attrs} />
        </article>
      </div>

      <EventLog logs={logs} onClear={() => setLogs([])} />
    </main>
  );
}

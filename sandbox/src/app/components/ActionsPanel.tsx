import type { createActions } from '../actions.ts';

interface ActionsPanelProps {
  ready: boolean;
  act: (name: keyof ReturnType<typeof createActions>) => void;
}

export function ActionsPanel({ ready, act }: ActionsPanelProps) {
  return (
    <>
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
    </>
  );
}

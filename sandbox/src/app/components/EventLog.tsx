import { useEffect, useRef } from 'react';
import { LOG_ICONS } from '../helpers.ts';

export interface LogEntry {
  id: number;
  type: string;
  msg: string;
  time: string;
}

interface EventLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function EventLog({ logs, onClear }: EventLogProps) {
  const logBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight;
    }
  }, []);

  return (
    <article>
      <header>
        <strong>
          Event Log <small>({logs.length})</small>
        </strong>
        <button
          type="button"
          className="outline"
          style={{ marginLeft: '0.5rem' }}
          onClick={onClear}
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
  );
}

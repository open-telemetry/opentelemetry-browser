import type { SandboxConfig } from '../hooks/use-sandbox-config.ts';

export function SandboxConfigForm({ cfg }: { cfg: SandboxConfig }) {
  const {
    serviceName,
    serviceVersion,
    tracesUrl,
    logsUrl,
    customAttrs,
    configDirty,
    updateField,
    setServiceName,
    setServiceVersion,
    setTracesUrl,
    setLogsUrl,
    updateAttr,
    removeAttr,
    addAttr,
  } = cfg;

  return (
    <article>
      <header>
        <strong>SDK Config</strong>
      </header>
      <label>
        serviceName
        <input
          type="text"
          value={serviceName}
          onChange={updateField(setServiceName)}
          placeholder="my-frontend-app"
        />
      </label>
      <label>
        serviceVersion
        <input
          type="text"
          value={serviceVersion}
          onChange={updateField(setServiceVersion)}
          placeholder="1.0.0"
        />
      </label>
      <label>
        tracesUrl
        <input
          type="text"
          value={tracesUrl}
          onChange={updateField(setTracesUrl)}
          placeholder="http://localhost:4318/v1/traces"
        />
      </label>
      <label>
        logsUrl
        <input
          type="text"
          value={logsUrl}
          onChange={updateField(setLogsUrl)}
          placeholder="http://localhost:4318/v1/logs"
        />
      </label>

      {configDirty && (
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
      {customAttrs.map((attr, i) => (
        <div className="attr-row" key={attr.id}>
          <input
            type="text"
            value={attr.key}
            onChange={(e) => updateAttr(i, 'key', e.target.value)}
            placeholder="key"
          />
          <span>:</span>
          <input
            type="text"
            value={attr.val}
            onChange={(e) => updateAttr(i, 'val', e.target.value)}
            placeholder="value"
          />
          <button
            type="button"
            className="outline secondary"
            onClick={() => removeAttr(i)}
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        className="outline btn-add-attr"
        style={{ marginLeft: '0.5rem' }}
        onClick={addAttr}
      >
        + Add attribute
      </button>
    </article>
  );
}

import type { OtelConfig } from '../types/OtelConfig.type.ts';

export function CodeSnippet({
  config,
  attrs,
}: {
  config: OtelConfig;
  attrs: Record<string, string>;
}) {
  const entries = Object.entries(attrs);
  return (
    <div className="code-block">
      <span className="kw">import</span>
      {' { '}
      <span className="fn">BrowserSDK</span>
      {' } '}
      <span className="kw">from</span>{' '}
      <span className="str">'@opentelemetry/browser-instrumentation'</span>
      {';\n\n'}
      <span className="kw">const</span>
      {' sdk = '}
      <span className="kw">new</span> <span className="fn">BrowserSDK</span>
      {'({\n'}
      {'  '}
      <span className="prop">serviceName</span>
      {':    '}
      <span className="str">{`'${config.serviceName}'`}</span>
      {',\n'}
      {'  '}
      <span className="prop">serviceVersion</span>
      {': '}
      <span className="str">{`'${config.serviceVersion}'`}</span>
      {',\n'}
      {'  '}
      <span className="prop">otlpExporterConfig</span>
      {': {\n'}
      {'    '}
      <span className="prop">tracesUrl</span>
      {': '}
      <span className="str">{`'${config.tracesUrl}'`}</span>
      {',\n'}
      {'    '}
      <span className="prop">logsUrl</span>
      {'  : '}
      <span className="str">{`'${config.logsUrl}'`}</span>
      {',\n'}
      {'  }'}
      {entries.length > 0 && (
        <>
          {',\n  '}
          <span className="prop">attributes</span>
          {': {\n'}
          {entries.map(([k, v]) => (
            <span key={k}>
              {'    '}
              <span className="prop">{k}</span>
              {': '}
              <span className="str">{`'${v}'`}</span>
              {',\n'}
            </span>
          ))}
          {'  }'}
        </>
      )}
      {',\n});\n\nsdk.'}
      <span className="fn">start</span>
      {'();'}
    </div>
  );
}

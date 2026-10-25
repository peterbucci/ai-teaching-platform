/** Compact display only. Links and assignment requests always retain the full ID. */
export function PublishedVersionLabel({ version }: { version: string }) {
  if (version.length <= 24)
    return (
      <h3 className="awa-version-label">
        Version <code className="awa-version-id">{version}</code>
      </h3>
    );
  return (
    <div className="awa-version-label">
      <h3>Published version</h3>
      <details className="awa-version-disclosure">
        <summary aria-label={`Inspect full published version ${version}`}>
          <code className="awa-version-id">
            {version.slice(0, 8)}…{version.slice(-6)}
          </code>
        </summary>
        <p className="awa-note">Exact immutable ID</p>
        <code className="awa-version-id">{version}</code>
      </details>
    </div>
  );
}

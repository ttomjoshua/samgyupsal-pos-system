import PublicBrand from '../../../shared/components/common/PublicBrand'

function AuthShowcasePanel({
  eyebrow,
  title,
  description,
  highlights = [],
  snapshotTitle = '',
  snapshotItems = [],
  note = '',
}) {
  return (
    <aside className="auth-showcase-panel">
      <PublicBrand compact showDescription={false} />

      <div className="auth-showcase-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="auth-showcase-highlights">
        {highlights.map((item) => (
          <article key={item.title} className="auth-showcase-highlight">
            <strong>{item.title}</strong>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      {snapshotItems.length > 0 ? (
        <section className="auth-showcase-snapshot">
          {snapshotTitle ? <span>{snapshotTitle}</span> : null}
          <div className="auth-showcase-snapshot-grid">
            {snapshotItems.map((item) => (
              <article key={`${item.label}-${item.value}`}>
                <strong>{item.label}</strong>
                <p>{item.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {note ? <p className="auth-showcase-note">{note}</p> : null}
    </aside>
  )
}

export default AuthShowcasePanel

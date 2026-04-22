import PublicBrand from '../../../shared/components/common/PublicBrand'

function AuthShowcasePanel({
  eyebrow,
  title,
  description,
  highlights = [],
  note = '',
}) {
  return (
    <aside className="auth-showcase-panel">
      <PublicBrand />

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

      {note ? <p className="auth-showcase-note">{note}</p> : null}
    </aside>
  )
}

export default AuthShowcasePanel

function PosShortcutCard({ title, description }) {
  return (
    <article className="pos-shortcut-card">
      <p className="card-label">POS module</p>
      <h3>{title}</h3>
      <p className="supporting-text">{description}</p>
    </article>
  )
}

export default PosShortcutCard

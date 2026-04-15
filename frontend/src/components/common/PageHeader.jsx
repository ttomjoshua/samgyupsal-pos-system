function PageHeader({ title, description, badge }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{badge}</p>
        <h2>{title}</h2>
        <p className="supporting-text">{description}</p>
      </div>
    </header>
  )
}

export default PageHeader

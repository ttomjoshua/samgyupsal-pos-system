function ReportTile({ title, detail }) {
  return (
    <article className="report-tile">
      <p className="card-label">Report</p>
      <h3>{title}</h3>
      <p className="supporting-text">{detail}</p>
    </article>
  )
}

export default ReportTile

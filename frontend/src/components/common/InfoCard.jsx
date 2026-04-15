function InfoCard({ label, value, helper }) {
  return (
    <article className="info-card">
      <p className="card-label">{label}</p>
      <strong>{value}</strong>
      <p className="supporting-text">{helper}</p>
    </article>
  )
}

export default InfoCard

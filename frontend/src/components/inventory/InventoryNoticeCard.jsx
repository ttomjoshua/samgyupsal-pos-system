function InventoryNoticeCard({ title, description }) {
  return (
    <article className="inventory-notice-card">
      <p className="card-label">Inventory module</p>
      <h3>{title}</h3>
      <p className="supporting-text">{description}</p>
    </article>
  )
}

export default InventoryNoticeCard

import { peso } from '../../utils/formatters'

function SummaryCards({ summary }) {
  const cards = [
    {
      label: 'Total Sales',
      value: peso(summary?.total_sales || 0),
      note: 'Revenue captured within the selected reporting range.',
    },
    {
      label: 'Transactions',
      value: summary?.transaction_count || 0,
      note: 'Completed checkout records included in this review.',
    },
    {
      label: 'Items Sold',
      value: summary?.items_sold || 0,
      note: 'Total units sold across all recorded transactions.',
    },
    {
      label: 'Low Stock Items',
      value: summary?.low_stock_count || 0,
      note: 'Catalog items currently sitting at or below risk level.',
    },
  ]

  return (
    <div className="reports-summary-grid">
      {cards.map((card) => (
        <article key={card.label} className="summary-card info-card">
          <p className="card-label">{card.label}</p>
          <h3>{card.value}</h3>
          <p className="summary-card-note">{card.note}</p>
        </article>
      ))}
    </div>
  )
}

export default SummaryCards

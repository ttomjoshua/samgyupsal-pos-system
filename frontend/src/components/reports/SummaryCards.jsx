import { peso } from '../../utils/formatters'

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Sales', value: peso(summary?.total_sales || 0) },
    {
      label: 'Transactions',
      value: summary?.transaction_count || 0,
    },
    {
      label: 'Items Sold',
      value: summary?.items_sold || 0,
    },
    {
      label: 'Low Stock Items',
      value: summary?.low_stock_count || 0,
    },
  ]

  return (
    <div className="reports-summary-grid">
      {cards.map((card) => (
        <article key={card.label} className="summary-card info-card">
          <p className="card-label">{card.label}</p>
          <h3>{card.value}</h3>
        </article>
      ))}
    </div>
  )
}

export default SummaryCards

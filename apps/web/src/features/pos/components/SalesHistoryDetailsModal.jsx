import StatusBadge from '../../../shared/components/common/StatusBadge'
import Modal from '../../../shared/components/ui/Modal'
import { shortDateTime } from '../../../shared/utils/formatters'
import ReceiptPreview from './ReceiptPreview'
import {
  buildReceiptPreviewData,
  getSaleDiscountTypeLabel,
  getSaleItemCount,
  getSalePaymentMethodLabel,
  getSaleReference,
} from '../services/salesService'

function SalesHistoryDetailsModal({ sale, isOpen, onClose }) {
  if (!sale) {
    return null
  }

  const receipt = buildReceiptPreviewData(sale)
  const soldItemCount = getSaleItemCount(sale)
  const detailCards = [
    {
      label: 'Transaction',
      value: getSaleReference(sale),
    },
    {
      label: 'Recorded At',
      value: shortDateTime(sale.submitted_at || sale.created_at),
    },
    {
      label: 'Cashier',
      value: sale.cashier_name || 'Unknown Cashier',
    },
    {
      label: 'Branch',
      value: sale.branch_name || 'All Branches',
    },
    {
      label: 'Payment',
      value: getSalePaymentMethodLabel(sale.payment_method),
    },
    {
      label: 'Discount Type',
      value: getSaleDiscountTypeLabel(sale),
    },
    {
      label: 'Items Sold',
      value: `${soldItemCount} item${soldItemCount === 1 ? '' : 's'}`,
    },
  ]

  return (
    <Modal
      isOpen={isOpen}
      title="Transaction Details"
      eyebrow="Sales History"
      description="Review the complete transaction breakdown without changing any recorded data."
      onClose={onClose}
      width="960px"
    >
      <div className="sales-history-detail-shell">
        <div className="sales-history-detail-header">
          <div>
            <p className="card-label">Record Status</p>
            <StatusBadge text="Completed" tone="normal" />
          </div>
        </div>

        <div className="sales-history-detail-grid">
          {detailCards.map((card) => (
            <article key={card.label} className="sales-history-detail-card">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <ReceiptPreview receipt={receipt} showActions={false} />
      </div>
    </Modal>
  )
}

export default SalesHistoryDetailsModal

import { peso, shortDateTime } from '../../../shared/utils/formatters'
import '../styles/receipt.css'

function ReceiptPreview({ receipt, onClose }) {
  if (!receipt) {
    return null
  }

  return (
    <div className="receipt-preview">
      <div className="receipt-card">
        <div className="receipt-line">
          <strong>Transaction</strong>
          <span>{receipt.transactionNumber}</span>
        </div>
        <div className="receipt-line">
          <strong>Cashier</strong>
          <span>{receipt.cashierName}</span>
        </div>
        <div className="receipt-line">
          <strong>Branch</strong>
          <span>{receipt.branchName}</span>
        </div>
        <div className="receipt-line">
          <strong>Date</strong>
          <span>{shortDateTime(receipt.issuedAt)}</span>
        </div>

        <div className="receipt-items">
          {receipt.items.map((item) => (
            <div key={item.id} className="receipt-line">
              <div>
                <strong>{item.name}</strong>
                <div className="supporting-text">
                  {item.quantity} x {peso(item.unitPrice)}
                </div>
              </div>
              <span>{peso(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="receipt-total-block">
          <div className="receipt-line">
            <span>Subtotal</span>
            <strong>{peso(receipt.subtotal)}</strong>
          </div>
          <div className="receipt-line">
            <span>Discount</span>
            <strong>{peso(receipt.discount)}</strong>
          </div>
          <div className="receipt-line">
            <span>Total</span>
            <strong>{peso(receipt.total)}</strong>
          </div>
          <div className="receipt-line">
            <span>Cash Received</span>
            <strong>{peso(receipt.cashReceived)}</strong>
          </div>
          <div className="receipt-line">
            <span>Change</span>
            <strong>{peso(receipt.change)}</strong>
          </div>
        </div>

        <p className="receipt-notes">
          Payment method: <strong>{receipt.paymentMethodLabel}</strong>
        </p>
      </div>

      <div className="receipt-actions">
        <button
          type="button"
          className="ghost-action"
          onClick={onClose}
        >
          Close Receipt
        </button>
      </div>
    </div>
  )
}

export default ReceiptPreview

import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import { paymentMethods as defaultPaymentMethods } from '../../services/salesService'
import {
  validateCheckout,
} from '../../utils/validation'
import { peso } from '../../utils/formatters'
import '../../styles/checkout.css'

function CheckoutModal({
  isOpen,
  onClose,
  cartItems = [],
  onSubmitSale,
  paymentMethods = defaultPaymentMethods,
}) {
  const [paymentMethod, setPaymentMethod] = useState(
    paymentMethods[0]?.value || 'cash',
  )
  const [discount, setDiscount] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [notes, setNotes] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [errors, setErrors] = useState({})
  const [isConfirming, setIsConfirming] = useState(false)

  const subtotalAmount = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      ),
    [cartItems],
  )

  const numericDiscount = Number(discount || 0)
  const totalAmount = Math.max(0, subtotalAmount - numericDiscount)
  const change = Math.max(0, Number(amountReceived || 0) - totalAmount)

  useEffect(() => {
    if (!isOpen) {
      setPaymentMethod(paymentMethods[0]?.value || 'cash')
      setDiscount('')
      setAmountReceived('')
      setNotes('')
      setShowPreview(false)
      setErrors({})
      setIsConfirming(false)
    }
  }, [isOpen, paymentMethods])

  const handlePreview = () => {
    const validation = validateCheckout({
      paymentMethod,
      amountReceived,
      discount,
      subtotalAmount,
      totalAmount,
      cartItems,
    })

    if (!validation.isValid) {
      setErrors(validation.errors)
      return
    }

    setErrors({})
    setShowPreview(true)
  }

  const handleConfirm = async () => {
    const payload = {
      payment_method: paymentMethod,
      subtotal: subtotalAmount,
      discount: numericDiscount,
      total_amount: totalAmount,
      cash_received:
        paymentMethod === 'cash' ? Number(amountReceived || 0) : totalAmount,
      change_amount: paymentMethod === 'cash' ? change : 0,
      notes: notes.trim(),
      items: cartItems.map((item) => ({
        product_id: item.id,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.price || 0),
      })),
    }

    try {
      setIsConfirming(true)
      setErrors({})
      await onSubmitSale?.(payload)
      setShowPreview(false)
      onClose?.()
    } catch (error) {
      setErrors({
        submit: error.message || 'Unable to submit this sale right now.',
      })
      setShowPreview(false)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Checkout"
      eyebrow="Reusable Checkout Flow"
      description="Collect the cashier's final sale values before submitting."
      width="680px"
    >
      {!showPreview ? (
        <div className="checkout-grid">
          <div className="form-row">
            <label className="summary-field">
              <span>Payment Method</span>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="summary-field">
              <span>Amount Received</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountReceived}
                onChange={(event) => setAmountReceived(event.target.value)}
                placeholder="Enter amount received"
              />
            </label>
          </div>

          <label className="summary-field">
            <span>Discount (PHP)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              placeholder="0.00"
            />
          </label>

          <label className="summary-field">
            <span>Notes</span>
            <textarea
              className="checkout-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional remarks for this sale."
              rows={3}
            />
          </label>

          <div className="checkout-preview-summary">
            <div className="summary-row">
              <span>Items</span>
              <strong>{cartItems.length}</strong>
            </div>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{peso(subtotalAmount)}</strong>
            </div>
            <div className="summary-row">
              <span>Discount</span>
              <strong>{peso(numericDiscount)}</strong>
            </div>
            <div className="summary-row total-row">
              <span>Total</span>
              <strong>{peso(totalAmount)}</strong>
            </div>
          </div>

          {Object.keys(errors).length > 0 ? (
            <div className="checkout-errors" role="alert">
              {Object.values(errors).map((error) => (
                <p key={error} className="checkout-error">
                  {error}
                </p>
              ))}
            </div>
          ) : null}

          <div className="modal-actions">
            <button type="button" className="ghost-action" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="checkout-action" onClick={handlePreview}>
              Review
            </button>
          </div>
        </div>
      ) : (
        <div className="checkout-grid">
          <div className="checkout-preview-summary">
            <div className="summary-row">
              <span>Payment Method</span>
              <strong>
                {paymentMethods.find((method) => method.value === paymentMethod)?.label ||
                  'Cash'}
              </strong>
            </div>
            <div className="summary-row">
              <span>Amount Received</span>
              <strong>{peso(amountReceived)}</strong>
            </div>
            <div className="summary-row">
              <span>Subtotal</span>
              <strong>{peso(subtotalAmount)}</strong>
            </div>
            <div className="summary-row">
              <span>Discount</span>
              <strong>{peso(numericDiscount)}</strong>
            </div>
            <div className="summary-row">
              <span>Change</span>
              <strong>{peso(change)}</strong>
            </div>
            <div className="summary-row total-row">
              <span>Total</span>
              <strong>{peso(totalAmount)}</strong>
            </div>
          </div>

          <div className="checkout-preview-list">
            {cartItems.map((item) => (
              <div key={item.id} className="checkout-preview-row">
                <div>
                  <strong>{item.name}</strong>
                  <div className="supporting-text">
                    {item.quantity} x {peso(item.price)}
                  </div>
                </div>
                <strong>{peso(item.quantity * item.price)}</strong>
              </div>
            ))}
          </div>

          {notes ? (
            <div className="checkout-preview-summary">
              <div className="summary-row">
                <span>Notes</span>
                <strong>{notes}</strong>
              </div>
            </div>
          ) : null}

          <div className="modal-actions">
            <button
              type="button"
              className="ghost-action"
              onClick={() => setShowPreview(false)}
              disabled={isConfirming}
            >
              Back
            </button>
            <button
              type="button"
              className="checkout-action"
              onClick={handleConfirm}
              disabled={isConfirming}
            >
              {isConfirming ? 'Submitting...' : 'Confirm Sale'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default CheckoutModal

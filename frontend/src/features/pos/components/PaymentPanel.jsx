import { useMemo, useState } from 'react'
import NoticeBanner from '../../../shared/components/common/NoticeBanner'
import Modal from '../../../shared/components/ui/Modal'
import SelectMenu from '../../../shared/components/ui/SelectMenu'
import ReceiptPreview from './ReceiptPreview'
import useAuth from '../../auth/hooks/useAuth'
import { createSale, paymentMethods } from '../services/salesService'
import { peso } from '../../../shared/utils/formatters'
import {
  getFirstValidationError,
  validateCheckout,
} from '../../../shared/utils/validation'

function PaymentPanel({
  cart,
  setCart,
  onOrderComplete,
  transactionNumber,
  branchId = null,
  branchName = '',
}) {
  const { user } = useAuth()
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState('info')
  const [submitting, setSubmitting] = useState(false)
  const [lastReceipt, setLastReceipt] = useState(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [heldOrder, setHeldOrder] = useState(null)

  const getUnitPrice = (item) => {
    const unitPrice = Number(item?.price ?? item?.unit_price ?? item?.unitPrice ?? 0)
    return Number.isFinite(unitPrice) ? unitPrice : 0
  }

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + getUnitPrice(item) * Number(item.quantity || 0),
        0,
      ),
    [cart],
  )

  const numericDiscount = Number(discount || 0)
  const total = Math.max(0, subtotal - numericDiscount)
  const change = Number(cashReceived || 0) - total

  const resetPanel = () => {
    setDiscount(0)
    setPaymentMethod('cash')
    setCashReceived('')
  }

  const clearStatusMessage = () => {
    if (!message) {
      return
    }

    setMessage('')
    setMessageTone('info')
  }

  const handleClear = () => {
    if (!cart.length) {
      setMessage('Cart is already empty.')
      setMessageTone('warning')
      return
    }

    setCart([])
    resetPanel()
    setMessage('Cart cleared.')
    setMessageTone('info')
  }

  const handleHold = () => {
    if (!cart.length) {
      setMessage('Cart is empty.')
      setMessageTone('warning')
      return
    }

    if (heldOrder) {
      setMessage('Restore or clear the current held order before placing another one on hold.')
      setMessageTone('warning')
      return
    }

    const heldOrderSnapshot = {
      branchId,
      branchName: branchName || user?.branchName || 'All Branches',
      cashReceived,
      cart: cart.map((item) => ({ ...item })),
      discount,
      heldAt: new Date().toISOString(),
      paymentMethod,
    }

    setHeldOrder(heldOrderSnapshot)
    setCart([])
    resetPanel()
    setMessage(
      `Order placed on hold for ${heldOrderSnapshot.branchName}. Restore it when the guest is ready.`,
    )
    setMessageTone('info')
  }

  const handleRestoreHeldOrder = () => {
    if (!heldOrder) {
      return
    }

    if (cart.length > 0) {
      setMessage('Clear or checkout the current cart before restoring the held order.')
      setMessageTone('warning')
      return
    }

    if (
      heldOrder.branchId != null &&
      branchId != null &&
      Number(heldOrder.branchId) !== Number(branchId)
    ) {
      setMessage(`Switch back to ${heldOrder.branchName} before restoring this held order.`)
      setMessageTone('warning')
      return
    }

    setCart(heldOrder.cart.map((item) => ({ ...item })))
    setDiscount(heldOrder.discount)
    setPaymentMethod(heldOrder.paymentMethod)
    setCashReceived(heldOrder.cashReceived)
    setHeldOrder(null)
    setMessage('Held order restored.')
    setMessageTone('success')
  }

  const handleDiscardHeldOrder = () => {
    if (!heldOrder) {
      return
    }

    setHeldOrder(null)
    setMessage('Held order cleared.')
    setMessageTone('info')
  }

  const handleCheckout = async () => {
    if (!user?.id) {
      setMessage('Logged-in cashier id is missing.')
      setMessageTone('error')
      return
    }

    const validation = validateCheckout({
      paymentMethod,
      amountReceived: cashReceived,
      totalAmount: total,
      subtotalAmount: subtotal,
      discount: numericDiscount,
      cartItems: cart,
    })

    if (!validation.isValid) {
      setMessage(getFirstValidationError(validation.errors))
      setMessageTone('error')
      return
    }

    const payload = {
      cashier_id: user?.id,
      payment_method: paymentMethod,
      subtotal,
      discount: numericDiscount,
      total_amount: total,
      cash_received: Number(cashReceived || 0),
      change_amount: paymentMethod === 'cash' ? change : 0,
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: getUnitPrice(item),
      })),
    }

    const receiptSnapshot = {
      transactionNumber,
      cashierName: user?.name || 'Admin User',
      branchName: branchName || user?.branchName || 'All Branches',
      issuedAt: new Date().toISOString(),
      paymentMethodLabel:
        paymentMethods.find((method) => method.value === paymentMethod)?.label ||
        'Cash',
      subtotal,
      discount: numericDiscount,
      total,
      cashReceived: Number(cashReceived || 0),
      change: paymentMethod === 'cash' ? Math.max(0, change) : 0,
      items: cart.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: getUnitPrice(item),
        lineTotal: getUnitPrice(item) * Number(item.quantity),
      })),
    }

    try {
      setSubmitting(true)
      const result = await createSale(payload, {
        cashierName: user?.name,
        branchId: branchId ?? user?.branchId,
        branchName: branchName || user?.branchName,
        items: cart.map((item) => ({
          product_id: item.id,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: getUnitPrice(item),
        })),
      })
      setCart([])
      resetPanel()
      setLastReceipt(receiptSnapshot)
      setMessage('Sale recorded successfully. Reports and inventory have been updated.')
      setMessageTone('success')
      onOrderComplete?.('checkout', {
        inventorySynced: result.inventorySynced,
        soldItems: payload.items,
      })
    } catch (error) {
      setMessage(error.response?.data?.message || 'Checkout failed.')
      setMessageTone('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="cart-summary">
      <div className="form-row">
        <label className="summary-field">
          <span>Discount (PHP)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={discount}
            onChange={(event) => {
              clearStatusMessage()
              setDiscount(event.target.value)
            }}
            aria-invalid={Boolean(message)}
          />
        </label>

        <label className="summary-field">
          <span>Payment Method</span>
          <SelectMenu
            value={paymentMethod}
            onChange={(event) => {
              clearStatusMessage()
              setPaymentMethod(event.target.value)
            }}
            aria-invalid={Boolean(message)}
            options={paymentMethods}
          />
        </label>
      </div>

      <label className="summary-field">
        <span>Cash Received</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={cashReceived}
          onChange={(event) => {
            clearStatusMessage()
            setCashReceived(event.target.value)
          }}
          placeholder="Enter amount received"
          aria-invalid={Boolean(message)}
        />
      </label>

      <div className="summary-row">
        <span>Subtotal</span>
        <strong>{peso(subtotal)}</strong>
      </div>
      <div className="summary-row">
        <span>Discount</span>
        <strong>{peso(numericDiscount)}</strong>
      </div>
      <div className="summary-row total-row">
        <span>Total</span>
        <strong>{peso(total)}</strong>
      </div>
      <div className="summary-row">
        <span>Change</span>
        <strong>{peso(paymentMethod === 'cash' ? Math.max(0, change) : 0)}</strong>
      </div>

      <div className="summary-actions">
        <button
          type="button"
          className="ghost-action"
          onClick={handleHold}
          disabled={submitting || cart.length === 0}
        >
          Hold
        </button>
        <button
          type="button"
          className="ghost-action"
          onClick={handleClear}
          disabled={submitting || cart.length === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className="checkout-action"
          onClick={handleCheckout}
          disabled={submitting || cart.length === 0}
        >
          {submitting ? 'Submitting...' : 'Checkout'}
        </button>
      </div>

      <p className="supporting-text">
        {cart.length} item{cart.length === 1 ? '' : 's'} ready for checkout.
      </p>

      {message ? (
        <NoticeBanner
          variant={messageTone}
          title="Checkout"
          message={message}
        />
      ) : null}

      {heldOrder ? (
        <div className="receipt-launcher">
          <button
            type="button"
            className="ghost-action"
            onClick={handleRestoreHeldOrder}
          >
            Restore Held Order
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={handleDiscardHeldOrder}
          >
            Clear Held Order
          </button>
        </div>
      ) : null}

      {lastReceipt ? (
        <div className="receipt-launcher">
          <button
            type="button"
            className="ghost-action"
            onClick={() => setIsReceiptOpen(true)}
          >
            View Last Receipt
          </button>
        </div>
      ) : null}

      <Modal
        isOpen={isReceiptOpen}
        title="Receipt Preview"
        eyebrow="POS Receipt"
        description="Preview the latest completed sale without changing the current checkout flow."
        onClose={() => setIsReceiptOpen(false)}
        width="520px"
      >
        <ReceiptPreview
          receipt={lastReceipt}
          onClose={() => setIsReceiptOpen(false)}
        />
      </Modal>
    </div>
  )
}

export default PaymentPanel

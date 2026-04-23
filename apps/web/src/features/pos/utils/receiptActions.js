import { peso, shortDateTime } from '../../../shared/utils/formatters.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizeFileToken(value) {
  return String(value || 'transaction')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'transaction'
}

function buildReceiptRows(receipt = {}) {
  const items = Array.isArray(receipt.items) ? receipt.items : []

  if (items.length === 0) {
    return `
      <tr>
        <td colspan="2" style="padding: 16px 0; color: #6f6359; text-align: center;">
          No line items were recorded for this transaction.
        </td>
      </tr>
    `
  }

  return items
    .map((item) => {
      const helperText = item.isServiceFee
        ? 'Service fee line'
        : `${Number(item.quantity || 0)} x ${peso(item.unitPrice)}`

      return `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #eadfd3; vertical-align: top;">
            <div style="font-weight: 700; color: #201712;">${escapeHtml(item.name)}</div>
            <div style="margin-top: 4px; font-size: 12px; color: #6f6359;">${escapeHtml(helperText)}</div>
          </td>
          <td style="padding: 10px 0; border-bottom: 1px solid #eadfd3; text-align: right; vertical-align: top; white-space: nowrap; font-weight: 700; color: #201712;">
            ${escapeHtml(peso(item.lineTotal))}
          </td>
        </tr>
      `
    })
    .join('')
}

function buildReceiptDocumentStyles() {
  return `
    :root {
      color-scheme: light;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 24px;
      background: #f6f1ea;
      color: #201712;
    }

    .receipt-sheet {
      width: min(100%, 760px);
      margin: 0 auto;
      border: 1px solid #e1d6ca;
      border-radius: 24px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 24px 50px rgba(25, 20, 15, 0.1);
    }

    .receipt-topband {
      padding: 24px 28px 18px;
      background:
        radial-gradient(circle at top left, rgba(212, 127, 59, 0.18), transparent 42%),
        linear-gradient(135deg, #fff7f0 0%, #ffffff 100%);
      border-bottom: 1px solid #eadfd3;
    }

    .receipt-kicker {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #9a5725;
    }

    .receipt-title-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .receipt-title-row h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.08;
    }

    .receipt-copy {
      margin: 8px 0 0;
      max-width: 420px;
      color: #6f6359;
      line-height: 1.55;
    }

    .receipt-reference {
      min-width: 220px;
      padding: 14px 16px;
      border: 1px solid #eadfd3;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.92);
      text-align: right;
    }

    .receipt-reference span {
      display: block;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #6f6359;
    }

    .receipt-reference strong {
      display: block;
      margin-top: 6px;
      font-size: 18px;
      color: #201712;
    }

    .receipt-body {
      display: grid;
      gap: 24px;
      padding: 24px 28px 30px;
    }

    .receipt-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .receipt-meta-card {
      padding: 14px 16px;
      border: 1px solid #eadfd3;
      border-radius: 18px;
      background: #fcfaf8;
    }

    .receipt-meta-card span {
      display: block;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #6f6359;
    }

    .receipt-meta-card strong {
      display: block;
      margin-top: 7px;
      font-size: 15px;
      line-height: 1.45;
      color: #201712;
    }

    .receipt-section h2 {
      margin: 0 0 14px;
      font-size: 15px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6f6359;
    }

    .receipt-items-table {
      width: 100%;
      border-collapse: collapse;
    }

    .receipt-items-table th {
      padding: 0 0 10px;
      border-bottom: 1px solid #d8cabd;
      text-align: left;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #6f6359;
    }

    .receipt-items-table th:last-child {
      text-align: right;
    }

    .receipt-summary {
      padding: 18px 20px;
      border-radius: 20px;
      border: 1px solid #eadfd3;
      background: linear-gradient(180deg, #fffaf6 0%, #ffffff 100%);
    }

    .receipt-summary-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 7px 0;
      color: #4a3b30;
    }

    .receipt-summary-row strong {
      white-space: nowrap;
      color: #201712;
    }

    .receipt-summary-row--total {
      margin-top: 6px;
      padding-top: 14px;
      border-top: 1px solid #e4d8cb;
      font-size: 17px;
      font-weight: 800;
      color: #201712;
    }

    .receipt-notes {
      padding: 16px 18px;
      border-radius: 18px;
      background: #f8f3ee;
      color: #5d4d42;
      line-height: 1.55;
    }

    .receipt-notes strong {
      color: #201712;
    }

    @media print {
      body {
        padding: 0;
        background: #ffffff;
      }

      .receipt-sheet {
        width: 100%;
        border: none;
        border-radius: 0;
        box-shadow: none;
      }
    }

    @media (max-width: 640px) {
      body {
        padding: 12px;
      }

      .receipt-topband,
      .receipt-body {
        padding-left: 18px;
        padding-right: 18px;
      }

      .receipt-meta {
        grid-template-columns: 1fr;
      }

      .receipt-reference {
        min-width: 0;
        width: 100%;
        text-align: left;
      }
    }
  `
}

export function getReceiptFilename(receipt = {}) {
  return `${sanitizeFileToken(receipt.transactionNumber || 'receipt')}.html`
}

export function buildReceiptDocumentHtml(receipt = {}, options = {}) {
  const transactionNumber = receipt.transactionNumber || 'Pending transaction'
  const itemsCount = Array.isArray(receipt.items) ? receipt.items.length : 0
  const documentTitle = escapeHtml(options.documentTitle || 'Sales Receipt')
  const headerTitle = escapeHtml(options.headerTitle || 'Sales Receipt')
  const supportingCopy = escapeHtml(
    options.supportingCopy ||
      'Review the completed transaction, line items, and totals in a printable business receipt format.',
  )
  const notes = [
    `Payment Method: ${receipt.paymentMethodLabel || 'Cash'}`,
  ]

  if (receipt.discountTypeLabel && Number(receipt.discount || 0) > 0) {
    notes.push(`Discount Type: ${receipt.discountTypeLabel}`)
  }

  if (receipt.notes) {
    notes.push(`Notes: ${receipt.notes}`)
  }

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${documentTitle} - ${escapeHtml(transactionNumber)}</title>
        <style>${buildReceiptDocumentStyles()}</style>
      </head>
      <body>
        <main class="receipt-sheet">
          <div class="receipt-topband">
            <p class="receipt-kicker">Transaction Review</p>
            <div class="receipt-title-row">
              <div>
                <h1>${headerTitle}</h1>
                <p class="receipt-copy">${supportingCopy}</p>
              </div>
              <div class="receipt-reference">
                <span>Transaction ID</span>
                <strong>${escapeHtml(transactionNumber)}</strong>
              </div>
            </div>
          </div>

          <div class="receipt-body">
            <section class="receipt-meta">
              <article class="receipt-meta-card">
                <span>Cashier</span>
                <strong>${escapeHtml(receipt.cashierName || 'Unknown Cashier')}</strong>
              </article>
              <article class="receipt-meta-card">
                <span>Branch</span>
                <strong>${escapeHtml(receipt.branchName || 'All Branches')}</strong>
              </article>
              <article class="receipt-meta-card">
                <span>Recorded At</span>
                <strong>${escapeHtml(shortDateTime(receipt.issuedAt))}</strong>
              </article>
              <article class="receipt-meta-card">
                <span>Line Items</span>
                <strong>${escapeHtml(`${itemsCount} line item${itemsCount === 1 ? '' : 's'}`)}</strong>
              </article>
            </section>

            <section class="receipt-section">
              <h2>Purchased Items</h2>
              <table class="receipt-items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${buildReceiptRows(receipt)}
                </tbody>
              </table>
            </section>

            <section class="receipt-summary">
              <div class="receipt-summary-row">
                <span>Subtotal</span>
                <strong>${escapeHtml(peso(receipt.subtotal))}</strong>
              </div>
              <div class="receipt-summary-row">
                <span>Service Fees</span>
                <strong>${escapeHtml(peso(receipt.serviceFeeTotal))}</strong>
              </div>
              <div class="receipt-summary-row">
                <span>Discount</span>
                <strong>${escapeHtml(peso(receipt.discount))}</strong>
              </div>
              <div class="receipt-summary-row receipt-summary-row--total">
                <span>Total</span>
                <strong>${escapeHtml(peso(receipt.total))}</strong>
              </div>
              <div class="receipt-summary-row">
                <span>Cash Received</span>
                <strong>${escapeHtml(peso(receipt.cashReceived))}</strong>
              </div>
              <div class="receipt-summary-row">
                <span>Change</span>
                <strong>${escapeHtml(peso(receipt.change))}</strong>
              </div>
            </section>

            <section class="receipt-notes">
              <strong>Transaction Notes</strong>
              <div style="margin-top: 8px;">${escapeHtml(notes.join(' | '))}</div>
            </section>
          </div>
        </main>
      </body>
    </html>
  `
}

export async function copyTextToClipboard(value) {
  const normalizedValue = String(value || '')

  if (!normalizedValue) {
    throw new Error('Nothing to copy.')
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalizedValue)
    return
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard access is not available in this environment.')
  }

  const fallbackElement = document.createElement('textarea')
  fallbackElement.value = normalizedValue
  fallbackElement.setAttribute('readonly', 'readonly')
  fallbackElement.style.position = 'fixed'
  fallbackElement.style.opacity = '0'
  fallbackElement.style.pointerEvents = 'none'

  document.body.appendChild(fallbackElement)
  fallbackElement.focus()
  fallbackElement.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(fallbackElement)

  if (!copied) {
    throw new Error('Copy to clipboard failed.')
  }
}

export function downloadReceipt(receipt, options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Receipt downloads require a browser environment.')
  }

  const receiptMarkup = buildReceiptDocumentHtml(receipt, options)
  const receiptBlob = new Blob([receiptMarkup], {
    type: 'text/html;charset=utf-8',
  })
  const blobUrl = window.URL.createObjectURL(receiptBlob)
  const downloadLink = document.createElement('a')
  downloadLink.href = blobUrl
  downloadLink.download = getReceiptFilename(receipt)
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
  window.setTimeout(() => {
    window.URL.revokeObjectURL(blobUrl)
  }, 0)
}

export function printReceipt(receipt, options = {}) {
  if (typeof window === 'undefined') {
    throw new Error('Printing requires a browser environment.')
  }

  const printWindow = window.open(
    '',
    '_blank',
    'noopener,noreferrer,width=520,height=760',
  )

  if (!printWindow) {
    throw new Error('Pop-up blocked. Allow pop-ups to print the receipt.')
  }

  const receiptMarkup = buildReceiptDocumentHtml(receipt, options).replace(
    '</body>',
    `
      <script>
        window.addEventListener('load', function () {
          window.focus();
          window.print();
        });
        window.addEventListener('afterprint', function () {
          window.close();
        });
      </script>
    </body>
    `,
  )

  printWindow.document.open()
  printWindow.document.write(receiptMarkup)
  printWindow.document.close()
}

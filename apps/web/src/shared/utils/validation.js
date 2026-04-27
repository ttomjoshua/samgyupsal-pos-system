import {
  getStandardProductCategoryLabel,
  isValidBarcodeValue,
  normalizeBarcodeValue,
} from './categoryUtils.js'

function collapseWhitespace(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function parseNumericInput(value) {
  if (value === '' || value == null) {
    return NaN
  }

  return Number(value)
}

function isWholeNumber(value) {
  return Number.isInteger(parseNumericInput(value))
}

export function normalizeSearchInput(value) {
  return collapseWhitespace(value)
}

export function getFirstValidationError(errors = {}) {
  return Object.values(errors)[0] || ''
}

export function validateLoginForm(formData = {}, options = {}) {
  const useEmail = options.useEmail === true
  const username = collapseWhitespace(formData.username)
  const email = collapseWhitespace(formData.email).toLowerCase()
  const password = String(formData.password || '')
  const errors = {}

  if (useEmail) {
    if (!email) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.'
    }
  } else if (!username) {
    errors.username = 'Username is required.'
  }

  if (!password.trim()) {
    errors.password = 'Password is required.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      email,
      username,
      password,
    },
  }
}

export function validateCheckout({
  paymentMethod,
  amountReceived,
  totalAmount,
  cartItems,
  discount = 0,
  subtotalAmount = null,
} = {}) {
  const errors = {}
  const normalizedPaymentMethod = String(paymentMethod || '').trim().toLowerCase()
  const numericDiscount = Number(discount || 0)
  const normalizedTotalAmount = Number(totalAmount)
  const normalizedSubtotalAmount =
    subtotalAmount == null ? null : Number(subtotalAmount)

  if (!normalizedPaymentMethod) {
    errors.paymentMethod = 'Select a payment method.'
  }

  if (!Number.isFinite(normalizedTotalAmount) || normalizedTotalAmount < 0) {
    errors.totalAmount = 'Checkout total must be a valid amount.'
  }

  if (
    normalizedSubtotalAmount != null &&
    (!Number.isFinite(normalizedSubtotalAmount) || normalizedSubtotalAmount < 0)
  ) {
    errors.subtotalAmount = 'Checkout subtotal must be a valid amount.'
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    errors.cart = 'Cart cannot be empty.'
  }

  if (!errors.cart && Array.isArray(cartItems)) {
    for (const cartItem of cartItems) {
      const quantity = parseNumericInput(cartItem?.quantity)
      const availableStock = parseNumericInput(
        cartItem?.stockQuantity ?? cartItem?.stock_quantity,
      )
      const unitPrice = parseNumericInput(
        cartItem?.price ?? cartItem?.unit_price ?? cartItem?.unitPrice,
      )
      const itemName =
        String(cartItem?.name || cartItem?.item_name || 'This item').trim() ||
        'This item'

      if (!Number.isInteger(quantity) || quantity <= 0) {
        errors.cart = 'Cart quantities must be whole numbers greater than zero.'
        break
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.cart = `${itemName} cannot be sold until it has a valid price.`
        break
      }

      if (
        Number.isFinite(availableStock) &&
        availableStock >= 0 &&
        quantity > availableStock
      ) {
        errors.cart = `${itemName} only has ${availableStock} item${
          availableStock === 1 ? '' : 's'
        } in stock.`
        break
      }
    }
  }

  if (!Number.isFinite(numericDiscount) || numericDiscount < 0) {
    errors.discount = 'Discount cannot be negative.'
  }

  if (
    Number.isFinite(normalizedSubtotalAmount) &&
    numericDiscount > normalizedSubtotalAmount
  ) {
    errors.discount = 'Discount cannot be greater than the subtotal.'
  }

  if (normalizedPaymentMethod === 'cash') {
    const normalizedAmount =
      amountReceived === '' || amountReceived == null ? NaN : Number(amountReceived)

    if (!Number.isFinite(normalizedAmount)) {
      if (String(amountReceived || '').trim()) {
        errors.amountReceived = 'Enter a valid cash amount received.'
      } else if (normalizedTotalAmount > 0) {
        errors.amountReceived = 'Amount received is required for cash payments.'
      }
    } else if (normalizedAmount < normalizedTotalAmount) {
      errors.amountReceived =
        'Amount received must be equal to or greater than total amount.'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export function validateInventoryForm(formData = {}) {
  const productName = collapseWhitespace(formData.product_name || formData.name)
  const categoryName = getStandardProductCategoryLabel(
    collapseWhitespace(formData.category_name || formData.category),
  )
  const stockQuantity = formData.stock_quantity ?? formData.stock
  const unit = collapseWhitespace(formData.unit)
  const expiryDate = String(formData.expiry_date || '').trim()
  const reorderLevel = formData.reorder_level
  const barcode = normalizeBarcodeValue(formData.barcode)
  const hasReorderLevel =
    reorderLevel !== undefined &&
    reorderLevel !== null &&
    String(reorderLevel).trim() !== ''
  const priceValue = formData.price
  const numericPrice = Number(priceValue)
  const errors = {}

  if (!productName) {
    errors.name = 'Product name is required.'
  }

  if (!categoryName) {
    errors.category = 'Select a supported product category.'
  }

  if (stockQuantity === '' || stockQuantity == null) {
    errors.stock = 'Stock quantity is required.'
  } else if (!isWholeNumber(stockQuantity)) {
    errors.stock = 'Stock quantity must be a whole number.'
  } else if (Number(stockQuantity) < 0) {
    errors.stock = 'Stock cannot be negative.'
  }

  if (priceValue === undefined || priceValue === null || String(priceValue).trim() === '') {
    errors.price = 'Price is required.'
  } else if (!Number.isFinite(numericPrice)) {
    errors.price = 'Price must be a valid number.'
  } else if (numericPrice < 0) {
    errors.price = 'Price cannot be negative.'
  }

  if (hasReorderLevel && Number(reorderLevel) < 0) {
    errors.reorderLevel = 'Reorder level cannot be negative.'
  } else if (hasReorderLevel && !isWholeNumber(reorderLevel)) {
    errors.reorderLevel = 'Reorder level must be a whole number.'
  }

  if (!isValidBarcodeValue(barcode)) {
    errors.barcode =
      'Barcode can use letters, numbers, hyphens, slashes, dots, or underscores only.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedData: {
      ...formData,
      product_name: productName,
      category_name: categoryName,
      price: numericPrice,
      stock_quantity: Number(stockQuantity),
      unit,
      expiry_date: expiryDate || null,
      barcode: barcode || null,
      ...(hasReorderLevel ? { reorder_level: Number(reorderLevel) } : {}),
    },
  }
}

export function validateInventoryQuantityAction({
  selectedItem,
  quantityValue,
  mode,
} = {}) {
  const errors = {}
  const sanitizedAmount = Number(quantityValue)

  if (!selectedItem) {
    errors.quantity = 'Select an inventory item first.'
  } else if (!Number.isInteger(sanitizedAmount)) {
    errors.quantity =
      mode === 'adjust-stock'
        ? 'Enter the final stock count as a whole number.'
        : 'Enter a whole number stock quantity to continue.'
  } else if (mode === 'stock-in' && sanitizedAmount === 0) {
    errors.quantity = 'Stock in only accepts a positive quantity.'
  } else if (mode === 'stock-in' && sanitizedAmount < 0) {
    errors.quantity = 'Stock in only accepts a positive quantity.'
  } else if (mode === 'adjust-stock' && sanitizedAmount < 0) {
    errors.quantity = 'Final stock cannot be negative.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitizedAmount,
  }
}

export function validateReportDateRange({ dateFrom, dateTo } = {}) {
  const errors = {}
  const normalizedFrom = String(dateFrom || '').trim()
  const normalizedTo = String(dateTo || '').trim()

  if (!normalizedFrom) {
    errors.dateFrom = 'Start date is required.'
  }

  if (!normalizedTo) {
    errors.dateTo = 'End date is required.'
  }

  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    errors.dateRange = 'Start date must be earlier than or equal to end date.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
